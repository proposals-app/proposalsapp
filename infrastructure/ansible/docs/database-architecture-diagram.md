# Database Architecture Diagram

## Overview Architecture

```mermaid
graph TB
    subgraph "DC1 - Sibiu Romania"
        subgraph "apps-sib-01 Container"
            APP1[Application<br/>Workloads]
            PG1[pgpool-II<br/>:5432]
            CONFD1[Confd]
        end
        subgraph "db-sib-01 Container"
            DB1[(PostgreSQL<br/>Primary)]
            PATRONI1[Patroni]
            ETCD1[etcd]
        end
    end
    
    subgraph "DC2 - Sibiu Romania"
        subgraph "apps-sib-03 Container"
            APP2[Application<br/>Workloads]
            PG2[pgpool-II<br/>:5432]
            CONFD2[Confd]
        end
        subgraph "db-sib-03 Container"
            DB2[(PostgreSQL<br/>Replica)]
            PATRONI2[Patroni]
            ETCD2[etcd]
        end
    end
    
    subgraph "DC3 - Falkenstein Germany"
        subgraph "apps-fsn-01 Container"
            APP3[Application<br/>Workloads]
            PG3[pgpool-II<br/>:5432]
            CONFD3[Confd]
        end
        subgraph "db-fsn-01 Container"
            DB3[(PostgreSQL<br/>Replica)]
            PATRONI3[Patroni]
            ETCD3[etcd]
        end
    end
    
    %% Application connections
    APP1 -->|localhost:5432| PG1
    APP2 -->|localhost:5432| PG2
    APP3 -->|localhost:5432| PG3
    
    %% pgpool connections with weights
    PG1 -.->|"writes 100%"| DB1
    PG1 -.->|"reads 83%<br/>(weight=10)"| DB1
    PG1 -.->|"reads 8.5%<br/>(weight=1)"| DB2
    PG1 -.->|"reads 8.5%<br/>(weight=1)"| DB3
    
    PG2 -.->|"writes 100%"| DB1
    PG2 -.->|"reads 83%<br/>(weight=10)"| DB2
    PG2 -.->|"reads 8.5%<br/>(weight=1)"| DB1
    PG2 -.->|"reads 8.5%<br/>(weight=1)"| DB3
    
    PG3 -.->|"writes 100%"| DB1
    PG3 -.->|"reads 83%<br/>(weight=10)"| DB3
    PG3 -.->|"reads 8.5%<br/>(weight=1)"| DB1
    PG3 -.->|"reads 8.5%<br/>(weight=1)"| DB2
    
    %% Patroni manages PostgreSQL via etcd
    PATRONI1 <-->|"manages"| DB1
    PATRONI2 <-->|"manages"| DB2
    PATRONI3 <-->|"manages"| DB3
    
    %% Patroni uses etcd for consensus
    PATRONI1 <-->|"leader election"| ETCD1
    PATRONI2 <-->|"cluster state"| ETCD2
    PATRONI3 <-->|"cluster state"| ETCD3
    
    %% Confd watches etcd cluster
    CONFD1 -->|"watch"| ETCD1
    CONFD2 -->|"watch"| ETCD2
    CONFD3 -->|"watch"| ETCD3
    
    %% Confd generates pgpool config
    CONFD1 -->|"generates<br/>config"| PG1
    CONFD2 -->|"generates<br/>config"| PG2
    CONFD3 -->|"generates<br/>config"| PG3
    
    %% etcd cluster mesh
    ETCD1 <-.->|"raft consensus"| ETCD2
    ETCD2 <-.->|"raft consensus"| ETCD3
    ETCD1 <-.->|"raft consensus"| ETCD3
    
    %% Database replication
    DB1 ==>|"streaming<br/>replication"| DB2
    DB1 ==>|"streaming<br/>replication"| DB3
    
    classDef primary fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef replica fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef app fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef etcd fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    
    class DB1 primary
    class DB2,DB3 replica
    class APP1,APP2,APP3,PG1,PG2,PG3,CONFD1,CONFD2,CONFD3 app
    class ETCD1,ETCD2,ETCD3 etcd
```

## Component Interactions

### 1. Normal Operation Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant PG as pgpool-II
    participant Local as Local DB
    participant Primary as Primary DB
    participant Remote as Remote DB
    
    Note over App,Remote: READ Query Scenario
    App->>PG: SELECT * FROM users
    PG->>PG: Parse query (READ)
    PG->>PG: Weight calculation:<br/>Local=10, Remote=1
    alt 83% probability
        PG->>Local: Forward query
        Local-->>PG: Result set
    else 17% probability
        PG->>Remote: Forward query
        Remote-->>PG: Result set
    end
    PG-->>App: Return results
    
    Note over App,Remote: WRITE Query Scenario
    App->>PG: INSERT INTO users...
    PG->>PG: Parse query (WRITE)
    PG->>Primary: Forward to primary only
    Primary-->>PG: Confirmation
    PG-->>App: Return confirmation
```

### 2. Failover Scenario

```mermaid
sequenceDiagram
    participant Patroni as Patroni
    participant etcd as etcd Cluster
    participant Confd as Confd
    participant PG as pgpool-II
    participant App as Application
    
    Note over Patroni,App: Primary Failure Detected
    Patroni->>Patroni: Detect primary failure
    Patroni->>etcd: Update cluster state
    etcd->>etcd: Leader election
    etcd->>Patroni: New primary elected
    Patroni->>Patroni: Promote replica to primary
    
    Note over Patroni,App: Configuration Update
    etcd->>Confd: State change notification
    Confd->>Confd: Generate new backend config
    Confd->>PG: Update pgpool_backends.conf
    Confd->>PG: Send reload signal
    PG->>PG: Reload configuration
    
    Note over Patroni,App: Traffic Resumes
    App->>PG: New queries
    PG->>PG: Route to new primary
```

## Routing Scenarios

### Scenario 1: Read from DC2 Application
```
Application (DC2) → pgpool-II (DC2) → Weight-based routing:
  - 83% chance → PostgreSQL Replica (DC2) [weight=10]
  - 8.5% chance → PostgreSQL Primary (DC1) [weight=1]  
  - 8.5% chance → PostgreSQL Replica (DC3) [weight=1]
```

### Scenario 2: Write from DC3 Application
```
Application (DC3) → pgpool-II (DC3) → PostgreSQL Primary (DC1)
  - All writes go to primary regardless of location
  - pgpool identifies write queries and routes accordingly
```

### Scenario 3: Primary Failover (DC1 → DC2)
```
Before: DC1=Primary, DC2=Replica, DC3=Replica
After:  DC2=Primary, DC1=Down, DC3=Replica

1. Patroni detects DC1 failure
2. etcd coordinates election, DC2 becomes primary
3. Confd detects change in etcd
4. Confd updates all pgpool configurations
5. pgpool reloads, writes now go to DC2
```

## Data Flow Components

### pgpool-II Configuration
- **Load Balance Mode**: Enabled for read distribution
- **Master/Slave Mode**: Stream replication mode
- **Query Parser**: Identifies read vs write queries
- **Backend Weights**: Local=10, Remote=1
- **Connection Pooling**: Transaction mode
- **Environment-based routing**: Uses LOCAL_DATACENTER variable

### Confd Template Logic
```go
// Pseudo-code representation of Confd template
local_dc := getenv("LOCAL_DATACENTER")  // Set via systemd override

// Static backend configuration with dynamic weights
backend0_ip := getv("/local/ips/dc1")
backend0_weight := (local_dc == "dc1") ? 10 : 1

backend1_ip := getv("/local/ips/dc2")  
backend1_weight := (local_dc == "dc2") ? 10 : 1

backend2_ip := getv("/local/ips/dc3")
backend2_weight := (local_dc == "dc3") ? 10 : 1
```

### Weight-Based Distribution
- Local server gets 10/(10+1+1) = 83.3% of reads when all healthy
- With 3 servers total: Local=10, Remote1=1, Remote2=1
- Actual distribution: Local=83.3%, Remote1=8.3%, Remote2=8.3%
- If local is down: Remote1=50%, Remote2=50%
- Strong local preference minimizes cross-datacenter latency