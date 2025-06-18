# Ansible Vault Configuration

This document describes how sensitive configuration is managed in this infrastructure using Ansible Vault.

## Overview

Sensitive configuration values like API keys, tokens, and connection strings are stored encrypted using Ansible Vault. This ensures that sensitive data is never exposed in plain text in the repository.

## Vault Files

### General Infrastructure Secrets
- `group_vars/all/vault.yml` - Contains general infrastructure secrets like database passwords

### Application-Specific Secrets
- `group_vars/all/rindexer_vault.yml` - Contains rindexer-specific secrets:
  - Blockchain RPC endpoints with API keys
  - Block explorer API keys (Etherscan, Arbiscan, etc.)

## Usage

### Viewing Vault Contents
```bash
ansible-vault view group_vars/all/rindexer_vault.yml
```

### Editing Vault Contents
```bash
ansible-vault edit group_vars/all/rindexer_vault.yml
```

### Creating New Vault Files
```bash
ansible-vault create group_vars/all/new_vault.yml
```

## Vault Password

The vault password is configured in `ansible.cfg`:
```ini
vault_password_file = .vault_pass
```

This file (`.vault_pass`) should contain the vault password and must be present on the system running Ansible playbooks. This file is NOT committed to the repository.

## Variable Naming Convention

All variables stored in vault files should be prefixed with `vault_` to clearly indicate they come from an encrypted source:

```yaml
# In vault file:
vault_rindexer_ethereum_node_url: "https://..."

# In playbook:
- key: "rindexer/ethereum_node_url"
  value: "{{ vault_rindexer_ethereum_node_url }}"
```

## Security Best Practices

1. **Never commit the `.vault_pass` file** - It should be shared securely outside of git
2. **Always use `no_log: true`** when handling vault variables in playbooks
3. **Prefix vault variables** with `vault_` for clarity
4. **Separate concerns** - Use different vault files for different applications/services
5. **Audit access** - Limit who has access to the vault password

## Adding New Secrets

1. Edit the appropriate vault file:
   ```bash
   ansible-vault edit group_vars/all/rindexer_vault.yml
   ```

2. Add your new variable with the `vault_` prefix:
   ```yaml
   vault_new_api_key: "your-secret-key"
   ```

3. Reference it in your playbook:
   ```yaml
   - name: Store secret in Consul
     uri:
       url: "http://localhost:8500/v1/kv/service/api_key"
       method: PUT
       body: "{{ vault_new_api_key }}"
     no_log: true
   ```

## Troubleshooting

### "Attempting to decrypt but no vault secrets found"
Ensure the `.vault_pass` file exists and contains the correct password.

### "ERROR! Decryption failed"
The vault password is incorrect. Check your `.vault_pass` file.

### Variables not being decrypted
Ensure the vault file is in the correct location and is being loaded by Ansible.