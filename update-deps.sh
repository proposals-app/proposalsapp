   #!/bin/bash

   # Update Rust dependencies
   cargo autoinherit
   cargo upgrade
   cargo sort -w

   # Install npm-check-updates globally if not already installed
   if ! command -v ncu &> /dev/null; then
     echo "Installing npm-check-updates globally..."
     yarn global add npm-check-updates
   fi

   # Update root dependencies using npm-check-updates
   echo "Updating dependencies in the root project..."
   ncu -u
   yarn install

   # Find all projects in the workspace and update their dependencies
   echo "Updating dependencies in all workspace projects..."
   for project in $(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.react-email/*"); do
     project_dir=$(dirname "$project")
     echo "Updating dependencies in $project_dir..."

     # Run npm-check-updates
     (cd "$project_dir" && ncu -u && yarn install)
   done
