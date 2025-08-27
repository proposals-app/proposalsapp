   #!/bin/bash

   # Update Rust dependencies
   cargo autoinherit
   cargo upgrade
   cargo sort -w

   # Update root dependencies using npm-check-updates
   echo "Updating dependencies in the root project..."
   pnpm dlx npm-check-updates -u
   pnpm install

   # Find all projects in the workspace and update their dependencies
   echo "Updating dependencies in all workspace projects..."
   for project in $(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.react-email/*"); do
     project_dir=$(dirname "$project")
     echo "Updating dependencies in $project_dir..."

     # Run npm-check-updates
     (cd "$project_dir" && pnpm dlx npm-check-updates -u && pnpm install)
   done
