# Benchmarks
* __Machine:__ win32 x64 | 20 vCPUs | 31.8GB Mem
* __Node:__ `v18.12.1`
* __Run:__ Thu Jan 05 2023 21:45:20 GMT+0800 (中国标准时间)
* __Method:__ `autocannon -c 100 -d 40 -p 10 localhost:3000` (two rounds; one to warm-up, one to measure)
|         | Version | Router | Requests/s | Latency (ms) | Throughput/Mb |
| :--     | --:     | --:    | :-:        | --:          | --:           |
| fastify | 4.11.0  | ✓      | 86024.0    | 11.14        | 15.42         |
| fourze  | 0.22.0  | ✓      | 28428.4    | 34.67        | 5.67          |
| express | 4.18.1  | ✓      | 20482.4    | 48.30        | 4.92          |
