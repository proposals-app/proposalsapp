# Infrastructure

This directory contains all infrastructure code for ProposalsApp, including Ansible playbooks and Nomad job specifications.

## Directory Structure

```
infrastructure/
├── ansible/
│   ├── applications/           # Application-specific deployments
│   │   └── rindexer/          # Blockchain indexer
│   │       ├── rindexer.nomad
│   │       ├── setup-consul-kv.yml
│   │       └── README.md
│   ├── playbooks/
│   │   └── infrastructure/    # Infrastructure setup playbooks
│   │       ├── 01-provision-and-prepare-lxcs.yml
│   │       ├── 02-install-consul.yml
│   │       ├── 03-install-nomad.yml
│   │       ├── 04-install-etcd.yml
│   │       ├── 05-install-postgres.yml
│   │       ├── 06-install-pgcat.yml
│   │       ├── 98-maintenance-updates.yml
│   │       └── 99-destroy-lxc-containers.yml
│   ├── group_vars/            # Ansible variables
│   ├── inventory.yml          # Infrastructure inventory
│   └── templates/             # Configuration templates
├── terraform/                 # Terraform configurations (if any)
└── README.md                  # This file
```

## Organization Principles

### Infrastructure vs Applications

The infrastructure is organized into two main categories:

1. **Infrastructure Setup** (`ansible/playbooks/infrastructure/`)
   - Core services that provide the platform (Consul, Nomad, PostgreSQL, etc.)
   - Numbered playbooks to indicate execution order
   - Run once during initial setup or major infrastructure changes

2. **Application Deployments** (`ansible/applications/`)
   - Currently only includes the rindexer blockchain indexing service
   - The application directory contains:
     - Nomad job specification (`.nomad` file)
     - Ansible playbooks for configuration
     - Application-specific documentation
   - Frequently deployed and updated

### Deployment Workflow

#### Initial Infrastructure Setup

1. Run infrastructure playbooks in order:
   ```bash
   cd ansible
   ansible-playbook -i inventory.yml playbooks/infrastructure/01-provision-and-prepare-lxcs.yml
   ansible-playbook -i inventory.yml playbooks/infrastructure/02-install-consul.yml
   ansible-playbook -i inventory.yml playbooks/infrastructure/03-install-nomad.yml
   ansible-playbook -i inventory.yml playbooks/infrastructure/04-install-etcd.yml
   ansible-playbook -i inventory.yml playbooks/infrastructure/05-install-postgres.yml
   ansible-playbook -i inventory.yml playbooks/infrastructure/06-install-pgcat.yml
   ```

#### Application Deployment

1. Configure application-specific settings:
   ```bash
   # Example: Setup rindexer
   ansible-playbook -i inventory.yml applications/rindexer/setup-consul-kv.yml
   ```

2. Deploy with Nomad:
   ```bash
   nomad job run applications/rindexer/rindexer.nomad
   ```

### Benefits of This Structure

1. **Separation of Concerns**: Clear distinction between platform infrastructure and business applications
2. **Colocation**: All files related to an application (Nomad jobs, Ansible playbooks, docs) are in one place
3. **Discoverability**: Easy to find all components related to a specific service
4. **Modularity**: Applications can be deployed independently
5. **Documentation**: Each application can have its own README with specific instructions

### Adding New Applications

To add a new application:

1. Create a directory under `ansible/applications/<app-name>/`
2. Add the Nomad job specification: `<app-name>.nomad`
3. Add any Ansible playbooks for configuration
4. Include a README.md with deployment instructions
5. Update this documentation

### Maintenance

- Infrastructure playbooks should rarely change once stable
- Application deployments can be updated frequently
- Use `98-maintenance-updates.yml` for system-wide updates
- Use `99-destroy-lxc-containers.yml` with caution for cleanup