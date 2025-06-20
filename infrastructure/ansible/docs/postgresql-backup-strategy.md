# PostgreSQL Backup Strategy for ProposalsApp

## Overview

This document outlines the comprehensive backup and disaster recovery strategy for the ProposalsApp PostgreSQL cluster managed by Patroni. The strategy uses pgBackRest for backup management with S3-compatible object storage.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   DC1 (Sibiu)   │     │   DC2 (Sibiu)   │     │ DC3 (Germany)   │
│  PostgreSQL     │     │  PostgreSQL     │     │  PostgreSQL     │
│  + pgBackRest   │     │  + pgBackRest   │     │  + pgBackRest   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   S3-Compatible Store   │
                    │  (Backblaze B2/Wasabi)  │
                    │   - Full backups         │
                    │   - Incremental backups  │
                    │   - WAL archives         │
                    └─────────────────────────┘
```

## Backup Schedule & Retention Policy

### Schedule
- **Full Backup**: Weekly (Every Sunday at 02:00 UTC)
- **Incremental Backup**: Daily (Every day at 02:00 UTC except Sunday)
- **WAL Archive**: Continuous (Real-time)
- **Monthly Archive**: First Sunday of each month

### Retention
- **Full Backups**: 4 weeks
- **Incremental Backups**: 7 days
- **WAL Archives**: 14 days
- **Monthly Archives**: 12 months

### Recovery Objectives
- **RPO (Recovery Point Objective)**: < 1 minute with continuous WAL archiving
- **RTO (Recovery Time Objective)**: < 30 minutes for full recovery

## Implementation Steps

### Phase 1: Storage Setup

#### Option 1: Backblaze B2 (Recommended)
- Cost: ~$6/TB/month
- No minimum storage requirements
- S3-compatible API
- Good global performance

#### Option 2: Wasabi
- Cost: ~$7/TB/month
- No egress fees
- 1TB minimum billing
- S3-compatible API

#### Option 3: Self-hosted MinIO
- Full control over data
- No ongoing storage costs
- Requires separate infrastructure

Create bucket and access credentials:
```bash
# For Backblaze B2
# 1. Create account at https://www.backblaze.com/b2/
# 2. Create bucket: proposalsapp-db-backups
# 3. Create application key with read/write access
# 4. Note down:
#    - Endpoint: s3.us-west-004.backblazeb2.com
#    - Key ID and Application Key
#    - Bucket name
```

### Phase 2: pgBackRest Installation

Create the installation playbook:

```yaml
# File: infrastructure/ansible/playbooks/infrastructure/06-install-pgbackrest.yml
---
- name: Install and configure pgBackRest for PostgreSQL backup
  hosts: postgres_nodes
  become: true
  vars:
    pgbackrest_version: "2.51"
    pgbackrest_stanza: "proposalsapp"
    pgbackrest_repo_path: "/proposalsapp-backups"
    pgbackrest_s3_bucket: "{{ vault_pgbackrest_s3_bucket }}"
    pgbackrest_s3_endpoint: "{{ vault_pgbackrest_s3_endpoint }}"
    pgbackrest_s3_region: "{{ vault_pgbackrest_s3_region }}"
    pgbackrest_s3_key: "{{ vault_pgbackrest_s3_key }}"
    pgbackrest_s3_secret: "{{ vault_pgbackrest_s3_secret }}"
    pgbackrest_cipher_pass: "{{ vault_pgbackrest_cipher_pass }}"

  tasks:
    - name: Install pgBackRest
      apt:
        name: pgbackrest
        state: present
        update_cache: yes

    - name: Create pgBackRest directories
      file:
        path: "{{ item }}"
        state: directory
        owner: postgres
        group: postgres
        mode: "0750"
      loop:
        - /etc/pgbackrest
        - /var/log/pgbackrest
        - /var/lib/pgbackrest
        - /var/spool/pgbackrest

    - name: Generate pgBackRest configuration
      template:
        src: pgbackrest.conf.j2
        dest: /etc/pgbackrest/pgbackrest.conf
        owner: postgres
        group: postgres
        mode: "0640"

    - name: Create pgBackRest stanza
      command: |
        pgbackrest --stanza={{ pgbackrest_stanza }} stanza-create
      become_user: postgres
      run_once: true
      when: inventory_hostname == groups['postgres_nodes'][0]

    - name: Configure PostgreSQL for archiving
      lineinfile:
        path: /etc/patroni/patroni.yml
        regexp: "{{ item.regexp }}"
        line: "{{ item.line }}"
        insertafter: "{{ item.after | default(omit) }}"
      loop:
        - regexp: '^\s*archive_mode:'
          line: '    archive_mode: "on"'
          after: '  parameters:'
        - regexp: '^\s*archive_command:'
          line: '    archive_command: "pgbackrest --stanza={{ pgbackrest_stanza }} archive-push %p"'
          after: '    archive_mode:'
        - regexp: '^\s*archive_timeout:'
          line: '    archive_timeout: 60'
          after: '    archive_command:'

    - name: Add recovery configuration
      blockinfile:
        path: /etc/patroni/patroni.yml
        marker: "  # {mark} pgBackRest recovery configuration"
        insertafter: "postgresql:"
        block: |
          recovery_conf:
            restore_command: 'pgbackrest --stanza={{ pgbackrest_stanza }} archive-get %f "%p"'
            recovery_target_timeline: 'latest'

    - name: Add pgBackRest to replica creation methods
      blockinfile:
        path: /etc/patroni/patroni.yml
        marker: "  # {mark} pgBackRest replica creation"
        insertafter: "postgresql:"
        block: |
          create_replica_methods:
            - pgbackrest
            - basebackup
          
          pgbackrest:
            command: '/usr/bin/pgbackrest --stanza={{ pgbackrest_stanza }} --delta restore'
            keep_data: True
            no_params: True

    - name: Restart Patroni to apply configuration
      systemd:
        name: patroni
        state: restarted
      throttle: 1

    - name: Create backup systemd timer
      copy:
        content: |
          [Unit]
          Description=Weekly full pgBackRest backup
          
          [Timer]
          OnCalendar=weekly
          OnCalendar=Sun *-*-* 02:00:00
          RandomizedDelaySec=300
          Persistent=true
          
          [Install]
          WantedBy=timers.target
        dest: /etc/systemd/system/pgbackrest-full.timer
        mode: "0644"

    - name: Create backup systemd service
      copy:
        content: |
          [Unit]
          Description=pgBackRest full backup
          After=network.target
          
          [Service]
          Type=oneshot
          User=postgres
          ExecStartPre=/bin/bash -c 'patronictl -c /etc/patroni/patroni.yml list -f json | jq -e ".[] | select(.Host == \"$(hostname -f)\") | .Role == \"Leader\"" || exit 0'
          ExecStart=/usr/bin/pgbackrest --stanza={{ pgbackrest_stanza }} --type=full backup
          StandardOutput=journal
          StandardError=journal
        dest: /etc/systemd/system/pgbackrest-full.service
        mode: "0644"

    - name: Create incremental backup timer
      copy:
        content: |
          [Unit]
          Description=Daily incremental pgBackRest backup
          
          [Timer]
          OnCalendar=daily
          OnCalendar=Mon-Sat *-*-* 02:00:00
          RandomizedDelaySec=300
          Persistent=true
          
          [Install]
          WantedBy=timers.target
        dest: /etc/systemd/system/pgbackrest-incr.timer
        mode: "0644"

    - name: Create incremental backup service
      copy:
        content: |
          [Unit]
          Description=pgBackRest incremental backup
          After=network.target
          
          [Service]
          Type=oneshot
          User=postgres
          ExecStartPre=/bin/bash -c 'patronictl -c /etc/patroni/patroni.yml list -f json | jq -e ".[] | select(.Host == \"$(hostname -f)\") | .Role == \"Leader\"" || exit 0'
          ExecStart=/usr/bin/pgbackrest --stanza={{ pgbackrest_stanza }} --type=incr backup
          StandardOutput=journal
          StandardError=journal
        dest: /etc/systemd/system/pgbackrest-incr.service
        mode: "0644"

    - name: Enable and start backup timers
      systemd:
        name: "{{ item }}"
        enabled: yes
        state: started
        daemon_reload: yes
      loop:
        - pgbackrest-full.timer
        - pgbackrest-incr.timer

    - name: Create pgBackRest monitoring script
      copy:
        content: |
          #!/bin/bash
          # Check last backup age
          last_backup=$(pgbackrest --stanza={{ pgbackrest_stanza }} info --output=json | jq -r '.[0].backup[-1].timestamp.stop' 2>/dev/null)
          if [ -z "$last_backup" ]; then
            echo "ERROR: No backups found"
            exit 2
          fi
          
          age=$(($(date +%s) - $(date -d "$last_backup" +%s)))
          if [ $age -gt 93600 ]; then  # 26 hours
            echo "ERROR: Last backup is older than 26 hours"
            exit 2
          elif [ $age -gt 86400 ]; then  # 24 hours
            echo "WARNING: Last backup is older than 24 hours"
            exit 1
          else
            echo "OK: Last backup completed $(($age / 3600)) hours ago"
            exit 0
          fi
        dest: /usr/local/bin/check-pgbackrest-backup
        mode: "0755"

    - name: Create WAL archive monitoring script
      copy:
        content: |
          #!/bin/bash
          # Check WAL archiving is working
          if pgbackrest --stanza={{ pgbackrest_stanza }} check --archive-timeout=60 2>&1; then
            echo "OK: WAL archiving is working"
            exit 0
          else
            echo "ERROR: WAL archiving check failed"
            exit 2
          fi
        dest: /usr/local/bin/check-pgbackrest-archive
        mode: "0755"

    - name: Register monitoring scripts with Consul
      copy:
        content: |
          {
            "service": {
              "name": "pgbackrest",
              "tags": ["backup", "postgresql"],
              "port": 8432,
              "checks": [
                {
                  "id": "pgbackrest-backup-age",
                  "name": "pgBackRest Backup Age",
                  "script": "/usr/local/bin/check-pgbackrest-backup",
                  "interval": "1h"
                },
                {
                  "id": "pgbackrest-wal-archive",
                  "name": "pgBackRest WAL Archive",
                  "script": "/usr/local/bin/check-pgbackrest-archive",
                  "interval": "10m"
                }
              ]
            }
          }
        dest: /etc/consul.d/pgbackrest.json
        mode: "0644"

    - name: Reload Consul
      systemd:
        name: consul
        state: reloaded

    - name: Perform initial backup
      command: |
        pgbackrest --stanza={{ pgbackrest_stanza }} --type=full backup
      become_user: postgres
      run_once: true
      when: inventory_hostname == groups['postgres_nodes'][0]
```

### Phase 3: pgBackRest Configuration Template

Create the configuration template:

```ini
# File: infrastructure/ansible/templates/pgbackrest.conf.j2
[global]
# Repository configuration
repo1-type=s3
repo1-path={{ pgbackrest_repo_path }}
repo1-s3-bucket={{ pgbackrest_s3_bucket }}
repo1-s3-endpoint={{ pgbackrest_s3_endpoint }}
repo1-s3-region={{ pgbackrest_s3_region }}
repo1-s3-key={{ pgbackrest_s3_key }}
repo1-s3-secret={{ pgbackrest_s3_secret }}

# Encryption
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass={{ pgbackrest_cipher_pass }}

# Retention
repo1-retention-full=4
repo1-retention-full-type=count
repo1-retention-diff=7
repo1-retention-archive=14
repo1-retention-archive-type=days

# Performance
process-max=4
archive-async=y
archive-push-queue-max=4GiB
compress-type=zst
compress-level=3

# Logging
log-level-console=info
log-level-file=detail
log-path=/var/log/pgbackrest
log-timestamp=y

[{{ pgbackrest_stanza }}]
# PostgreSQL configuration
pg1-path=/var/lib/postgresql/17/main
pg1-port=5432

# All nodes in the cluster
{% for host in groups['postgres_nodes'] %}
pg{{ loop.index }}-host={{ hostvars[host]['tailscale_hostname'] }}
pg{{ loop.index }}-host-user=postgres
pg{{ loop.index }}-path=/var/lib/postgresql/17/main
{% endfor %}

# Backup from standby when possible
backup-standby=y
```

### Phase 4: Vault Configuration

Add these variables to your Ansible vault:

```yaml
# pgBackRest S3 configuration
vault_pgbackrest_s3_bucket: "proposalsapp-db-backups"
vault_pgbackrest_s3_endpoint: "s3.us-west-004.backblazeb2.com"
vault_pgbackrest_s3_region: "us-west-004"
vault_pgbackrest_s3_key: "your-access-key-id"
vault_pgbackrest_s3_secret: "your-secret-access-key"
vault_pgbackrest_cipher_pass: "your-strong-encryption-password"
```

### Phase 5: Disaster Recovery Procedures

#### Point-in-Time Recovery (PITR)

```bash
# 1. Stop Patroni on the target node
systemctl stop patroni

# 2. Clear the data directory
rm -rf /var/lib/postgresql/17/main/*

# 3. Restore to specific time
sudo -u postgres pgbackrest --stanza=proposalsapp \
  --type=time \
  --target="2024-12-20 14:15:00" \
  --target-action=promote \
  restore

# 4. Start Patroni
systemctl start patroni

# 5. Patroni will handle promotion and cluster reconfiguration
```

#### Full Cluster Recovery

```bash
# 1. Stop Patroni on all nodes
ansible postgres_nodes -m systemd -a "name=patroni state=stopped"

# 2. Clear data directories on all nodes
ansible postgres_nodes -m shell -a "rm -rf /var/lib/postgresql/17/main/*"

# 3. Restore on the designated primary
ssh db-sib-01
sudo -u postgres pgbackrest --stanza=proposalsapp restore

# 4. Start Patroni on primary first
systemctl start patroni

# 5. Wait for primary to be ready
patronictl -c /etc/patroni/patroni.yml list

# 6. Start Patroni on replicas
ansible postgres_nodes:!db-sib-01 -m systemd -a "name=patroni state=started"
```

#### Creating a New Replica

```bash
# 1. On the new replica node, ensure pgBackRest is configured
# 2. Clear any existing data
rm -rf /var/lib/postgresql/17/main/*

# 3. Patroni will automatically use pgBackRest to create the replica
systemctl start patroni

# 4. Monitor progress
journalctl -u patroni -f
```

### Phase 6: Testing and Validation

#### Monthly Restore Test Procedure

```bash
# 1. Create test VM/container
# 2. Install PostgreSQL and pgBackRest
# 3. Copy pgBackRest configuration
# 4. Perform test restore
pgbackrest --stanza=proposalsapp --type=time --target="1 hour ago" restore

# 5. Start PostgreSQL and verify data
pg_ctl start
psql -d proposalsapp -c "SELECT count(*) FROM proposals;"

# 6. Document results and any issues
```

#### Backup Validation Commands

```bash
# Check backup info
pgbackrest --stanza=proposalsapp info

# Verify specific backup
pgbackrest --stanza=proposalsapp verify

# Check WAL archive
pgbackrest --stanza=proposalsapp check --archive-timeout=60

# Test restore (dry-run)
pgbackrest --stanza=proposalsapp --dry-run restore
```

### Phase 7: Monitoring Integration

Add to your monitoring system:

```yaml
# Prometheus alerts
- alert: PostgreSQLBackupTooOld
  expr: time() - pgbackrest_last_backup_timestamp > 86400
  for: 1h
  annotations:
    summary: "PostgreSQL backup is older than 24 hours"
    
- alert: PostgreSQLWALArchiveFailing
  expr: pgbackrest_archive_check_failed == 1
  for: 10m
  annotations:
    summary: "PostgreSQL WAL archiving is failing"
```

## Cost Analysis

### Storage Costs (Estimated for 100GB database)
- Full backups: 4 × 100GB = 400GB (compressed to ~100GB)
- Incremental backups: 7 × 10GB = 70GB (compressed to ~20GB)
- WAL archives: 14 days × 5GB/day = 70GB
- Monthly archives: 12 × 100GB = 1200GB (compressed to ~300GB)
- **Total**: ~500GB storage = ~$3/month (Backblaze B2)

### Best Practices

1. **Security**
   - Use strong encryption passwords
   - Rotate S3 access keys regularly
   - Restrict S3 bucket access to backup nodes only
   - Enable S3 bucket versioning for additional protection

2. **Performance**
   - Take backups from standby nodes when possible
   - Use parallel processing (process-max)
   - Enable asynchronous WAL archiving
   - Use compression (zst recommended)

3. **Reliability**
   - Test restores monthly
   - Monitor backup age and WAL archiving
   - Document all procedures
   - Maintain runbooks for common scenarios

4. **Compliance**
   - Follows 3-2-1 backup rule
   - Meets GDPR requirements for data protection
   - Provides audit trail through logging
   - Supports compliance reporting

## Troubleshooting

### Common Issues

1. **Backup Fails with S3 Error**
   ```bash
   # Check S3 credentials
   pgbackrest --stanza=proposalsapp check
   
   # Test S3 connectivity
   aws s3 ls s3://proposalsapp-db-backups/ --endpoint-url=https://s3.us-west-004.backblazeb2.com
   ```

2. **WAL Archive Buildup**
   ```bash
   # Check archive status
   pgbackrest --stanza=proposalsapp info --set=archive
   
   # Force archive push
   pgbackrest --stanza=proposalsapp archive-push /var/lib/postgresql/17/main/pg_wal/*.ready
   ```

3. **Restore Performance**
   ```bash
   # Use parallel restore
   pgbackrest --stanza=proposalsapp --process-max=4 restore
   
   # Monitor progress
   tail -f /var/log/pgbackrest/proposalsapp-restore.log
   ```

## Maintenance

### Quarterly Tasks
- Review and update retention policies
- Verify backup storage usage and costs
- Update pgBackRest version if needed
- Review and update documentation

### Annual Tasks
- Full disaster recovery drill
- Security audit of backup infrastructure
- Review backup strategy effectiveness
- Plan for capacity growth