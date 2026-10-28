# syntax=docker/dockerfile:1
# eRPC proxy in front of dRPC for the rindexer; see apps/erpc/erpc.yaml.
#
# The upstream image is distroless (no shell, curl or wget), so the static
# binary is copied onto Alpine to allow a container health check.
FROM ghcr.io/erpc/erpc:0.4.0 AS erpc

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget \
    && addgroup -g 10001 appgroup \
    && adduser -D -u 10000 -G appgroup appuser
COPY --from=erpc /erpc-server /usr/local/bin/erpc-server
COPY apps/erpc/erpc.yaml /app/erpc.yaml
USER appuser:appgroup
WORKDIR /app
EXPOSE 4000 4001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:4000/healthcheck || exit 1
CMD ["erpc-server", "--require-config", "--config", "/app/erpc.yaml"]
