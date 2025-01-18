# OTel collector with Clickhouse backend

This repo facilities exploratory  experimentation activities around OTel (opentelemetry) collector and Clickhouse backend. It offers a pre-configured docker compose environment with the latest versions of both components.

Resources:

- [OTel Contrib Collector](https://github.com/open-telemetry/opentelemetry-collector-contrib)
  - It brings among other components, the [clickhouse exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/clickhouseexporter)
- [Clickhouse DB](https://github.com/ClickHouse/ClickHouse)
- Related Clickhouse Blogs:
  - [Building an Observability Solution with ClickHouse - Part 1 - Logs](https://clickhouse.com/blog/storing-log-data-in-clickhouse-fluent-bit-vector-open-telemetry)
  - [Building an Observability Solution with ClickHouse - Part 2 - Traces](https://clickhouse.com/blog/storing-traces-and-spans-open-telemetry-in-clickhouse)
