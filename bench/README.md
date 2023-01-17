# Benchmarks
* __Machine:__ win32 x64 | 6 vCPUs | 15.9GB Mem
* __Node:__ `v16.17.0`
* __Run:__ Mon Jan 16 2023 13:43:04 GMT+0800 (中国标准时间)
* __Method:__ `autocannon -c 100 -d 40 -p 10 localhost:3000` (two rounds; one to warm-up, one to measure)
|         | Version       | Router | Requests/s | Latency (ms) | Throughput/Mb |
| :--     | --:           | --:    | :-:        | --:          | --:           |
| fastify | 4.11.0        | ✓      | 35045.6    | 28.04        | 6.28          |
| fourze  | 0.23.0-beta.0 | ✓      | 11352.8    | 87.51        | 2.14          |
| express | 4.18.1        | ✓      | 6965.9     | 142.82       | 1.67          |
