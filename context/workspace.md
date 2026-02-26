# Blue Tees Golf — Workspace Context

This file is automatically included in every agent's context. It provides organizational knowledge that all agents need.

---

## Company Overview

Blue Tees Golf is a modern golf technology company. Our mission is "PLAY DIFFERENT" — we build tech-forward, accessible golf products that challenge the traditional country club aesthetic. We sell direct-to-consumer and through select retail partners.

## Products

### Launch Monitors
- Hardware-software embedded devices that track golf ball flight using radar and/or laser technology
- Connect to mobile app via BLE (Bluetooth Low Energy 5.0+)
- Measure: ball speed, launch angle, spin rate, carry distance, total distance, club head speed
- Price range: $300-800 consumer, competing against Garmin R10, Rapsodo MLM, FlightScope Mevo+

### Rangefinders
- Laser rangefinders with OLED displays
- Slope compensation, pin-lock vibration, magnetic mount
- Price range: $150-350

### Mobile App
- iOS and Android
- Companion app for launch monitors and rangefinders
- Features: shot tracking, session history, performance analytics, firmware updates (OTA)
- BLE connectivity for device communication

## Development Process

### Hardware Development (Waterfall, 29-45 weeks)
- **Concept/Trigger**: Problem statement, solution proposal, high-level feature set, cost estimate
- **MS1 (PRD)**: Full product requirements, technical specifications, BOM, timeline, risks
- **EVT**: Engineering validation — prove the concept works (Weeks 1-12)
- **DVT**: Design validation — refine, test reliability (Weeks 13-24)
- **PVT**: Production validation — production-ready (Weeks 25-36)
- **MP**: Mass production (Weeks 37+)

### Software Development (Agile, 6-12 week cycles)
- Runs in parallel with hardware development
- Synchronizes at hardware integration milestones (EVT, DVT, PVT)
- Tools: GitHub, Antigravity IDE

### Key Integration Points
- BLE protocol must be stable before DVT
- App features that depend on hardware data must have test fixtures by EVT
- OTA firmware update system must be validated during PVT

## Team

- Product team includes: Product Managers, Hardware Engineers, Software Engineers, Designers
- Cross-functional collaboration with Supply Chain, QA, Marketing
- Manufacturing partner based in China with quarterly production runs

## Brand Guidelines (Summary)

- **Voice**: Direct, tech-forward, conversational, slightly irreverent
- **Not**: Stuffy, traditional golf, country club, vague marketing-speak
- **Visual**: Navy backgrounds (#1B2A4A), neon green accents (#39FF14), clean sans-serif typography
- **Positioning**: Premium performance at accessible prices. Golf is a sport, not a lifestyle.

## Regulatory

- FCC certification required for US wireless devices
- IC certification for Canada
- CE marking for EU
- Certification timeline: 4-8 weeks per cert, typically during PVT phase
- BLE and radar modules have specific emission limits

---

*This workspace context is automatically prepended to every agent's system prompt. Edit it in Settings > Workspace Context to keep it current with your team's processes and products.*
