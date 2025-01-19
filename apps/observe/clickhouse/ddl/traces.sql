CREATE TABLE IF NOT EXISTS otel.otel_traces (
    Timestamp DateTime64(9) CODEC(Delta, ZSTD(1)),
    TraceId String CODEC(ZSTD(1)),
    SpanId String CODEC(ZSTD(1)),
    ParentSpanId String CODEC(ZSTD(1)),
    TraceState String CODEC(ZSTD(1)),
    SpanName LowCardinality(String) CODEC(ZSTD(1)),
    SpanKind LowCardinality(String) CODEC(ZSTD(1)),
    ServiceName LowCardinality(String) CODEC(ZSTD(1)),
    SeverityText LowCardinality(String) CODEC(ZSTD(1)),
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    ScopeName String CODEC(ZSTD(1)),
    ScopeVersion String CODEC(ZSTD(1)),
    SpanAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    Duration Int64 CODEC(ZSTD(1)),
    StatusCode LowCardinality(String) CODEC(ZSTD(1)),
    StatusMessage String CODEC(ZSTD(1)),
    Events Nested (
        Timestamp DateTime64(9),
        Name LowCardinality(String),
        Attributes Map(LowCardinality(String), String)
    ) CODEC(ZSTD(1)),
    Links Nested (
        TraceId String,
        SpanId String,
        TraceState String,
        Attributes Map(LowCardinality(String), String)
    ) CODEC(ZSTD(1)),
    -- Common HTTP attributes
    HttpMethod LowCardinality(String) MATERIALIZED SpanAttributes['http.method'] CODEC(ZSTD(1)),
    HttpTarget String MATERIALIZED SpanAttributes['http.target'] CODEC(ZSTD(1)),
    HttpStatusCode Nullable(UInt16) MATERIALIZED if(SpanAttributes['http.status_code'] != '', toUInt16OrNull(SpanAttributes['http.status_code']), NULL) CODEC(ZSTD(1)),
    HttpRoute LowCardinality(String) MATERIALIZED SpanAttributes['http.route'] CODEC(ZSTD(1)),
    HttpUrl String MATERIALIZED SpanAttributes['http.url'] CODEC(ZSTD(1)),
    NetPeerName String MATERIALIZED SpanAttributes['net.peer.name'] CODEC(ZSTD(1)),
    NetPeerPort Nullable(UInt16) MATERIALIZED if(SpanAttributes['net.peer.port'] != '', toUInt16OrNull(SpanAttributes['net.peer.port']), NULL) CODEC(ZSTD(1)),
    -- Next.js specific attributes
    NextSpanName LowCardinality(String) MATERIALIZED SpanAttributes['next.span_name'] CODEC(ZSTD(1)),
    NextSpanType LowCardinality(String) MATERIALIZED SpanAttributes['next.span_type'] CODEC(ZSTD(1)),
    NextRoute LowCardinality(String) MATERIALIZED SpanAttributes['next.route'] CODEC(ZSTD(1)),
    NextRsc UInt8 MATERIALIZED SpanAttributes['next.rsc'] = 'true' CODEC(ZSTD(1)),
    NextPage LowCardinality(String) MATERIALIZED SpanAttributes['next.page'] CODEC(ZSTD(1)),
    NextSegment LowCardinality(String) MATERIALIZED SpanAttributes['next.segment'] CODEC(ZSTD(1)),
    -- Rust and OpenTelemetry semantic conventions
    CodeFunction LowCardinality(String) MATERIALIZED SpanAttributes['code.function'] CODEC(ZSTD(1)),
    CodeNamespace LowCardinality(String) MATERIALIZED SpanAttributes['code.namespace'] CODEC(ZSTD(1)),
    CodeFilepath String MATERIALIZED SpanAttributes['code.filepath'] CODEC(ZSTD(1)),
    CodeLineNumber Nullable(UInt32) MATERIALIZED if(SpanAttributes['code.lineno'] != '', toUInt32OrNull(SpanAttributes['code.lineno']), NULL) CODEC(ZSTD(1)),
    ThreadId String MATERIALIZED SpanAttributes['thread.id'] CODEC(ZSTD(1)),
    ThreadName LowCardinality(String) MATERIALIZED SpanAttributes['thread.name'] CODEC(ZSTD(1)),
    ErrorType LowCardinality(String) MATERIALIZED SpanAttributes['error.type'] CODEC(ZSTD(1)),
    ErrorMessage String MATERIALIZED SpanAttributes['error.message'] CODEC(ZSTD(1)),
    ErrorStack String MATERIALIZED SpanAttributes['error.stack'] CODEC(ZSTD(1)),
    OtelLibraryName LowCardinality(String) MATERIALIZED SpanAttributes['otel.library.name'] CODEC(ZSTD(1)),
    OtelLibraryVersion String MATERIALIZED SpanAttributes['otel.library.version'] CODEC(ZSTD(1)),
    RpcSystem LowCardinality(String) MATERIALIZED SpanAttributes['rpc.system'] CODEC(ZSTD(1)),
    RpcService LowCardinality(String) MATERIALIZED SpanAttributes['rpc.service'] CODEC(ZSTD(1)),
    RpcMethod LowCardinality(String) MATERIALIZED SpanAttributes['rpc.method'] CODEC(ZSTD(1)),
    DbSystem LowCardinality(String) MATERIALIZED SpanAttributes['db.system'] CODEC(ZSTD(1)),
    DbName LowCardinality(String) MATERIALIZED SpanAttributes['db.name'] CODEC(ZSTD(1)),
    DbStatement String MATERIALIZED SpanAttributes['db.statement'] CODEC(ZSTD(1)),

    INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_res_attr_key mapKeys(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_res_attr_value mapValues(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_key mapKeys(SpanAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_value mapValues(SpanAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_duration Duration TYPE minmax GRANULARITY 1,
    INDEX idx_http_method HttpMethod TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_http_status_code HttpStatusCode TYPE minmax GRANULARITY 1,
    INDEX idx_next_route NextRoute TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_next_span_type NextSpanType TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_code_function CodeFunction TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_error_type ErrorType TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_thread_name ThreadName TYPE bloom_filter(0.01) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, SpanName, toDateTime(Timestamp))
TTL toDate(Timestamp) + toIntervalDay(180)
SETTINGS index_granularity=8192, ttl_only_drop_parts = 1;


CREATE TABLE IF NOT EXISTS otel.otel_traces_trace_id_ts (
     TraceId String CODEC(ZSTD(1)),
     Start DateTime CODEC(Delta, ZSTD(1)),
     End DateTime CODEC(Delta, ZSTD(1)),
     INDEX idx_trace_id TraceId TYPE bloom_filter(0.01) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toDate(Start)
ORDER BY (TraceId, Start)
TTL toDate(Start) + toIntervalDay(180)
SETTINGS index_granularity=8192, ttl_only_drop_parts = 1;


CREATE MATERIALIZED VIEW IF NOT EXISTS otel.otel_traces_trace_id_ts_mv
TO otel.otel_traces_trace_id_ts
AS SELECT
    TraceId,
    min(Timestamp) as Start,
    max(Timestamp) as End
FROM otel.otel_traces
WHERE TraceId != ''
GROUP BY TraceId;
