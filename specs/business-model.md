# Business Model — Medical ERP

> Living document. Last updated: April 2026.

## 1. Model Overview

**Type:** Tiered SaaS subscription with a generous free tier, designed to scale from solo specialists to large clinics.

**Core philosophy:** Start simple, grow powerful. A solo practitioner should be able to scale up within the same system without migrating data — the Stripe/Notion/Linear playbook adapted for healthcare.

## 2. Pricing Tiers

### At Launch (MVP)

Only two tiers on day one. Resist the urge to offer more until pricing data validates them.

| Tier | Monthly Price | Target | Key Features |
|------|--------------|--------|--------------|
| **Free** | $0 | Solo specialists trying the product | Unlimited locations, up to X patients, core modules |
| **Solo** | ~$29–39 USD (~RD$1,700–2,300) | Active solo specialists | Unlimited patients, commission tracking, full protocol engine lite |

### Post-Validation (v1.5 / v2)

Once 50–100 paying customers validate willingness to pay, expand to:

| Tier | Monthly Price | Target | Adds |
|------|--------------|--------|------|
| **Free** | $0 | Trial / light users | Basic features, limited patients |
| **Solo** | ~$29–39 | Active solo specialists | Unlimited usage, basic analytics |
| **Practice** | ~$99–129 | Small teams (2–5 providers) | Multi-user, shared protocols, team scheduling |
| **Clinic** | ~$299+ | 10+ providers | Multi-location governance, admin controls, integrations, compliance tools |
| **Enterprise** | Custom | Hospitals | SLAs, custom integrations, dedicated support |

### Why Multi-Location Stays in the Free Tier ⭐

In the DR, specialists routinely work at 2–4 centers. Most international ERPs treat multi-location as a premium feature, which feels hostile to how local doctors actually work. Making it native and free is a core differentiator and a key marketing message.

**What becomes paid:** patient volume, team size, advanced features, integrations — not the reality of practicing at multiple centers.

## 3. Pricing Psychology

- **Annual billing with 2 months free** — improves cash flow and reduces churn
- **14–30 day free trial, no credit card** — lowers friction dramatically
- **Onboarding assistance included** on Practice tier and up — doctors need hand-holding, not just software
- **DOP and USD billing** — serve local market in local currency

## 4. Revenue Projections (Illustrative)

Rough sanity-check numbers for planning purposes:

| Scenario | Customers | Avg MRR/Customer | Monthly Revenue | Annual Revenue |
|----------|-----------|------------------|-----------------|----------------|
| Year 1 target | 100 solo | $29 | $2,900 | $34,800 |
| Year 2 target | 500 solo + 50 practice | $29 / $99 | $19,450 | $233,400 |
| Year 3 target | 1,000 solo + 200 practice + 20 clinic | $29 / $99 / $399 | $56,680 | $680,160 |

Healthcare SaaS typically has **low churn (<3%/month)** and high **LTV** when the product fits — doctors rarely switch systems once embedded in their workflow. This is our moat.

## 5. Go-to-Market Strategy

### Initial Beachhead

Pick 1–2 specialties where protocols matter most and dominate there before expanding. Candidates:

- **Physiotherapy** — protocol-heavy, high repeat visits, less price-sensitive
- **Pediatrics** — dosage-table heavy, strong word-of-mouth networks
- **Cardiology** — algorithm-heavy, high-income specialty

Generalist ERPs lose to specialists. Pick the specialty and win it.

### Marketing Angles

1. **Protocol engine as the hook** — most competitors don't have this; lead with it
2. **Multi-location native** — "Tus pacientes te siguen donde consultes"
3. **Bilingual from day one** — huge advantage in DR and broader LATAM
4. **Local compliance as trust signal** — explicit DR Law 87-01 compliance builds trust fast
5. **Specialty-focused messaging** — "The only ERP built for Dominican physiotherapists"

### Acquisition Channels (ordered by priority for a bootstrapped launch)

1. **Direct outreach** to specialists in target specialty (LinkedIn, medical association directories)
2. **Partnerships with medical associations** (SODOCARDIO, SODOPE, etc.)
3. **Content marketing** — Spanish-language blog on protocol management, practice management tips
4. **Referral program** — existing doctors refer peers for account credits
5. **Conference presence** at specialty medical congresses (low cost, high trust)

## 6. Future Revenue Streams

Beyond subscriptions, opportunities to add revenue without raising prices:

### Add-Ons
- Telemedicine module
- Advanced analytics package
- White-label / branded PDFs
- Extra storage / attachments

### Transaction-Based
- Small % fee on billing processed through the system (be careful — can feel extractive)
- Payment processing markup if acting as merchant of record

### Marketplace
- Lab integrations (paid referrals from partner labs)
- Pharmacy integrations (e-prescriptions to partner pharmacies)
- Insurance integrations
- Equipment / supply vendors

### B2B Expansion (Strategic Long-Term)

The *centros médicos* themselves become customers. Specialists using our app become the beachhead into selling to the centers where they practice — natural Clinic/Enterprise tier expansion.

## 7. Key Business Risks

| Risk | Mitigation |
|------|-----------|
| Doctors reluctant to pay for software | Free tier generous enough to prove value; clear ROI via time saved |
| Competition from international players | Local-first differentiation (multi-location, compliance, language) |
| Slow adoption due to workflow changes | White-glove onboarding; focus on speed of first value |
| Churn if product feels half-finished | Lock MVP scope tight; ship polish before features |
| Regulatory changes (DR health data law) | Build compliance in from day one; monitor local regulation |
| Payment collection in LATAM (failed cards, etc.) | Local payment processors; annual billing discount |

## 8. Success Metrics (Year 1)

- **MRR (Monthly Recurring Revenue):** Primary growth metric
- **Paid customer count:** Momentum indicator
- **Churn rate:** Must stay below 3%/month
- **CAC (Customer Acquisition Cost):** Keep < 3 months of payback
- **LTV:CAC ratio:** Target 3:1 or better
- **NPS:** > 40 indicates product-market fit emerging
- **Activation rate:** % of trial users who log a consultation within 7 days

## 9. Competitive Positioning

**What makes us different (defensible):**

1. **Native multi-location** — free tier, unlimited locations
2. **Protocol engine** — not an afterthought; a first-class module
3. **Built for DR/LATAM** — language, compliance, payment methods, workflow
4. **Specialty-focused** — deep for specific specialties vs. shallow-for-everyone

**What we're NOT trying to be (at least initially):**

- A generic international EHR
- A hospital information system
- A telemedicine platform
- A billing-only SaaS

## 10. Open Decisions

Things to finalize as we progress:

- [ ] Target specialty for first 10 customers
- [ ] Exact pricing validation (survey or early interviews?)
- [ ] Payment processor selection for DR market
- [ ] Free tier patient limit (50? 100? unlimited but feature-limited?)
- [ ] Annual vs monthly discount structure
- [ ] Referral program incentive structure
