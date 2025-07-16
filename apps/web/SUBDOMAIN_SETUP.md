# Subdomain Routing Setup

This guide helps you set up and test the subdomain routing functionality both in development and
production environments.

## Development Setup

To test subdomain routing locally, you need to:

1. **Configure your hosts file** to map subdomains to localhost
2. **Set up environment variables**
3. **Start the development server** with the correct hostname flag

### 1. Configure your hosts file

Edit your hosts file:

#### On macOS/Linux:

```bash
sudo nano /etc/hosts
```

#### On Windows:

Open Notepad as Administrator and open:

```
C:\Windows\System32\drivers\etc\hosts
```

Add the following lines:

```
127.0.0.1 localhost
127.0.0.1 arbitrum.localhost
127.0.0.1 uniswap.localhost
127.0.0.1 test-dao.localhost
# Add any other test subdomains you need
```

### 2. Environment Variables

Make sure your `.env.local` file contains:

```
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000
NEXT_PUBLIC_SPECIAL_SUBDOMAINS=arbitrum,uniswap
NODE_ENV=development
```

### 3. Start the development server

```bash
npm run dev -- --hostname localhost
# or
yarn dev --hostname localhost
```

## Testing Subdomains

Once set up, you can access:

- http://localhost:3000 - Main site
- http://arbitrum.localhost:3000 - Arbitrum specialized implementation
- http://uniswap.localhost:3000 - Uniswap specialized implementation
- http://test-dao.localhost:3000 - Generic DAO implementation with daoSlug="test-dao"

## Production Setup

For production:

1. **DNS Configuration**:
   - Configure your domain's DNS to point wildcard subdomains to your server
   - Example: `*.domain.com` points to your server IP

2. **Environment Variables**: Update `.env.production` or deployment environment:

   ```
   NEXT_PUBLIC_ROOT_DOMAIN=domain.com
   NEXT_PUBLIC_SPECIAL_SUBDOMAINS=arbitrum,uniswap
   NODE_ENV=production
   ```

3. **Web Server Configuration**:
   - If using Nginx, configure it to proxy all subdomains to your Next.js app
   - If using Vercel or similar, their platform typically handles subdomains automatically

## Nginx Example Configuration

```nginx
server {
    listen 80;
    server_name domain.com *.domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

- **Subdomain not working locally**: Make sure your hosts file is correctly configured and you're
  using the correct port
- **Middleware not running**: Check that path matchers in the middleware config are not excluding
  your routes
- **Special implementation not loading**: Verify that your special subdomain is included in the
  NEXT_PUBLIC_SPECIAL_SUBDOMAINS env variable
- **Custom implementation not found**: Check the URL pathname in the browser dev tools to ensure the
  rewrite is happening correctly

## Adding New Special Subdomains

1. Add the subdomain to the `NEXT_PUBLIC_SPECIAL_SUBDOMAINS` environment variable
2. Create a new directory in `app/` with the subdomain name (e.g., `app/newdao/`)
3. Implement the necessary files (page.tsx, layout.tsx, etc.)
4. Add the subdomain to your hosts file for local testing
5. Restart the development server
