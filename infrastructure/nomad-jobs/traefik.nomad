job "traefik" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "system"
  
  group "traefik" {
    network {
      port "http" {
        static = 80
      }
      port "api" {
        static = 8080
      }
    }
    
    task "traefik" {
      driver = "docker"
      
      config {
        image = "traefik:v3.0"
        ports = ["http", "api"]
        
        mount {
          type   = "bind"
          source = "/var/run/docker.sock"
          target = "/var/run/docker.sock"
          readonly = true
        }
      }
      
      template {
        data = <<EOF
[entryPoints]
  [entryPoints.http]
    address = ":80"
  [entryPoints.traefik]
    address = ":8080"

[api]
  dashboard = true

[ping]
  entryPoint = "traefik"

[providers.consulCatalog]
  endpoint.address = "{{ env "CONSUL_HTTP_ADDR" }}"
  endpoint.datacenter = "{{ env "CONSUL_DATACENTER" }}"
  exposedByDefault = false
  prefix = traefik
  
  [providers.consulCatalog.servicesFilter]
    tags = ["traefik.enable=true"]

[metrics]
  [metrics.prometheus]
    entryPoint = "traefik"
    addEntryPointsLabels = true
    addServicesLabels = true
EOF
        destination = "local/traefik.toml"
      }
      
      env {
        CONSUL_HTTP_ADDR = "{{ range service "consul" }}{{ .Address }}:{{ .Port }}{{ end }}"
        CONSUL_DATACENTER = "global"
      }
      
      resources {
        cpu    = 200
        memory = 256
      }
      
      service {
        name = "traefik"
        port = "http"
        tags = [
          "traefik.enable=true",
          "traefik.http.routers.api.rule=Host(`traefik.${attr.unique.network.ip-address}.nip.io`)",
          "traefik.http.routers.api.service=api@internal",
          "traefik.http.routers.api.entrypoints=traefik"
        ]
        
        check {
          type     = "http"
          path     = "/ping"
          port     = "api"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}