# AI Cost Analysis

## Development & Testing Costs (Actual)

### Cursor

- composer-1.5: **220.4M tokens**, **$65.75 included**
- Auto (Unlimited): **189.8M tokens**, **$0.00**
- **Cursor total:** **410.2M tokens**, **$65.75**

### OpenAI API

- **Total spend:** $9.50
- **Total tokens:** 34,782,318
- **Output tokens:** 283,692
- **Input tokens (derived):** 34,498,626
- **Total API requests:** 1,067

### Combined Observed AI Spend

- **Total spend:** **$75.25**
- **Total tokens:** **444,982,318**
- **Total requests:** **1,067 (+ Cursor internal requests)**

---

## Production Cost Projections (LLM Only)

### Assumptions

- Example projection only, using current usage numbers
- Average AI commands per user per session: **8**
- Average sessions per user per month: **4**
- Average commands per user per month: **32**
- Effective OpenAI cost per command (from actuals):
$9.50 / 1,067 requests = **$0.0089/request**

### Monthly LLM Cost Projection


| Users   | Estimated LLM Cost / Month |
| ------- | -------------------------- |
| 100     | $28.48                     |
| 1,000   | $284.82                    |
| 10,000  | $2,848.17                  |
| 100,000 | $28,481.72                 |


---

## Production Cost Projections (Infra Only - Separate)

### Assumptions

- Next.js app hosting + API runtime
- Managed Postgres + Realtime + storage
- Observability (logs/metrics), CDN/egress, worker/queue processing
- Costs scale approximately with active usage and realtime event volume


| Users   | App Hosting | DB + Realtime | Storage | Observability | CDN/Egress | Workers/Queues | Total Infra / Month |
| ------- | ----------- | ------------- | ------- | ------------- | ---------- | -------------- | ------------------- |
| 100     | $25         | $25           | $10     | $15           | $5         | $10            | **$90**             |
| 1,000   | $80         | $120          | $30     | $35           | $20        | $40            | **$325**            |
| 10,000  | $350        | $900          | $180    | $150          | $140       | $300           | **$2,020**          |
| 100,000 | $2,500      | $7,500        | $1,400  | $900          | $1,200     | $2,400         | **$15,900**         |


