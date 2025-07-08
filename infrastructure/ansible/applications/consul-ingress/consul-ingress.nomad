job "consul-ingress" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "system"

  group "ingress" {
    network {
      mode = "host"
      port "http" {
        static = 8080
        host_network = "tailscale"
      }
      port "admin" {
        static = 19000
        host_network = "tailscale"
      }
    }

    task "envoy" {
      driver = "docker"

      config {
        image = "envoyproxy/envoy:v1.28.0"
        network_mode = "host"
        
        args = [
          "-c", "/local/envoy.yaml",
          "-l", "info"
        ]

        volumes = [
          "local/envoy.yaml:/local/envoy.yaml:ro"
        ]
      }

      template {
        destination = "local/envoy.yaml"
        data = <<EOF
admin:
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 19000

static_resources:
  listeners:
  - name: ingress_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 8080
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_http
          codec_type: AUTO
          route_config:
            name: ingress_routes
            virtual_hosts:
            - name: web_service
              domains: ["proposals.app", "*.proposals.app", "arbitrum.proposals.app", "uniswap.proposals.app"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: web_cluster
                  timeout: 30s
            - name: homepage_service
              domains: ["dashboard.proposals.app"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: homepage_cluster
                  timeout: 30s
            - name: grafana_service
              domains: ["grafana.proposals.app"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: grafana_cluster
                  timeout: 30s
              request_headers_to_add:
              - header:
                  key: X-Forwarded-Host
                  value: "%REQ(HOST)%"
              - header:
                  key: X-Forwarded-Proto
                  value: "https"
            - name: prometheus_service
              domains: ["prometheus.proposals.app"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: prometheus_cluster
                  timeout: 30s
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
  - name: web_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: web_cluster
      endpoints:
      # Only use local datacenter services to avoid unreachable LXC IPs
      {{- range service "web" }}
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: {{ .Address }}
                port_value: {{ .Port }}
      {{- end }}

  - name: homepage_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: homepage_cluster
      endpoints:
      # Query all datacenters for single-instance services
      {{- range service "homepage" }}
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: {{ .Address }}
                port_value: {{ .Port }}
      {{- end }}
      {{- range datacenters }}
      {{- if ne . (env "DATACENTER") }}
      {{- $dc := . }}
      {{- range service (printf "homepage@%s" $dc) }}
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: {{ .Address }}
                port_value: {{ .Port }}
      {{- end }}
      {{- end }}
      {{- end }}

  - name: grafana_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: grafana_cluster
      endpoints:
      # Query all datacenters for single-instance services
      {{- range service "grafana" }}
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: {{ .Address }}
                port_value: {{ .Port }}
      {{- end }}
      {{- range datacenters }}
      {{- if ne . (env "DATACENTER") }}
      {{- $dc := . }}
      {{- range service (printf "grafana@%s" $dc) }}
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: {{ .Address }}
                port_value: {{ .Port }}
      {{- end }}
      {{- end }}
      {{- end }}

  - name: prometheus_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: prometheus_cluster
      endpoints:
      # Query all datacenters for single-instance services
      {{- range service "prometheus" }}
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: {{ .Address }}
                port_value: {{ .Port }}
      {{- end }}
      {{- range datacenters }}
      {{- if ne . (env "DATACENTER") }}
      {{- $dc := . }}
      {{- range service (printf "prometheus@%s" $dc) }}
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: {{ .Address }}
                port_value: {{ .Port }}
      {{- end }}
      {{- end }}
      {{- end }}
EOF
      }

      resources {
        cpu    = 200
        memory = 256
      }

      service {
        name = "consul-ingress"
        port = "http"
        address_mode = "host"
        
        check {
          type     = "http"
          path     = "/clusters"
          port     = "admin"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}