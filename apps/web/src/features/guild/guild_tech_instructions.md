You are a senior full-stack game developer and systems designer working on a live browser game.

I already have a working Guild system, and I want you to design and implement a new feature called **Academy**.

## Feature concept
Academy is a **guild-wide research / technology tree system**, inspired by the feeling of systems like **Rise of Kingdoms** research trees, but adapted for my browser game.

The core idea:
- The **entire guild contributes** to research.
- Guild members donate **Ducats** (our in-game currency/resource for this system).
- Each research node has multiple levels.
- Progress is accumulated collectively.
- Reaching certain levels unlocks:
  - new technologies
  - new branches
  - passive guild bonuses
  - milestone rewards
- Some nodes may require prerequisite nodes or required levels before unlocking.

I want this built in a way that is **config-driven**, scalable, clean, and easy to expand later without rewriting logic.

## What I need from you
I want you to act like the lead engineer and provide a complete implementation plan and code architecture for this Academy system.

Please cover all of the following:

### 1. System design
Design the full Academy feature, including:
- guild-wide research progression
- donation flow using Ducats
- research node unlock conditions
- level progression per node
- branch unlocking logic
- tech dependencies / prerequisites
- rewards and passive effects
- milestone / completion rewards
- future expandability

Please define:
- what data belongs to guild-level progression
- what data belongs to each academy node
- what data belongs to contribution history / donation logs
- how unlocks are evaluated
- how maxed nodes behave
- how new tech becomes visible / available

### 2. Config-driven tree architecture
Create a **single main config structure/file** for defining the entire Academy tree.

The config should allow us to define:
- number of branches
- branch names / ids
- node positions in the UI tree
- node prerequisites
- number of levels per node
- Ducat cost per level
- cumulative or per-level requirements
- unlock requirements
- rewards per level
- full completion reward for the node
- optional branch completion reward
- optional guild-wide bonuses
- sorting / display metadata
- icons / art keys / labels / descriptions
- whether a node is hidden until unlocked or always visible

I want the system to be easily editable by designers without changing business logic.

Please propose:
- the config schema
- a realistic example config with multiple branches and nodes
- validation rules for the config
- how the backend reads and uses the config

### 3. Research tree structure
The UI and data model should support a **tree-like research layout**.

Design it like this:
- the Academy background will be a **large square**
- the tree starts from the **center**
- from the center, there are **multiple branch options**
- each branch can grow outward with further nodes
- some nodes may split into sub-branches
- visually it should feel like a proper tech tree, not just a list

We will provide the background art later.

Please design the feature assuming:
- node positions are configurable
- lines/connectors between nodes can be drawn based on parent/prerequisite relationships
- branches can be asymmetrical
- future branches can be added later

### 4. UI / UX design
Design the Academy UI for a browser game.

I need you to propose:
- overall layout
- center starting node / academy core
- branch rendering
- node states:
  - locked
  - available
  - in progress
  - completed
  - maxed
- hover/click behavior
- node detail panel
- donation modal / interaction
- progress bars
- level indicators
- unlock indicators
- rewards preview
- contribution visibility
- guild activity / recent donations panel
- branch completion / node completion feedback
- responsiveness considerations for browser
- panning / zooming if necessary

Important:
- design the UI around a **big square background**
- tree starts in the middle
- multiple branches spread around from the center
- we will provide the background art
- make the UI implementation practical, not just conceptual

Please also suggest:
- component breakdown
- state management approach
- how to render connectors efficiently
- how to keep the tree readable when large

### 5. Backend / database design
Handle backend and DB design too.

Please provide:
- database schema/tables
- relationships
- indexes
- how guild academy progress is stored
- how node level progress is stored
- how member donations are stored
- how rewards are claimed or granted
- how unlock states are calculated
- whether some values should be persisted vs computed from config

I want you to think carefully about:
- data integrity
- race conditions when multiple guild members donate at the same time
- transactional safety
- preventing over-donation beyond required amount
- auditability / logging
- rollback strategy if a transaction fails
- performance when many guilds use Academy simultaneously

### 6. API design
Design the backend API for the system.

Please define endpoints / handlers for:
- fetching academy tree state for a guild
- fetching node details
- donating Ducats to a node
- claiming milestone rewards if applicable
- admin/debug endpoints if useful
- contribution history
- guild member contribution rankings if useful

For each endpoint, provide:
- purpose
- request shape
- response shape
- validation
- possible errors
- permission checks

### 7. Game logic / rules
Please formalize the rules, including:
- who can donate
- whether donation minimum/maximum exists
- whether members can donate to multiple nodes
- whether only one node can be actively researched at a time, or multiple in parallel
- how prerequisites work
- whether node progress resets or never resets
- how rewards are applied
- whether rewards are immediate per level or only on completion
- how branch unlocks work
- how guild joins/leaves affect contribution logic

If there are multiple good design options, compare them and recommend the best one for a browser game.

### 8. Implementation output
I do not want vague advice. I want actual implementation-oriented output.

Please provide in this order:

1. **Architecture overview**
2. **Recommended gameplay rules**
3. **Config schema**
4. **Example config file**
5. **Database schema**
6. **Backend service logic**
7. **API contracts**
8. **Frontend component structure**
9. **UI behavior details**
10. **Pseudocode or actual code skeletons**
11. **Edge cases and failure handling**
12. **Step-by-step implementation plan**

### 9. Code expectations
Please write production-minded code structure, not toy examples.

Assume a typical modern browser game stack. If you need to make assumptions, state them first, then proceed.

Your output should include:
- clean folder structure suggestion
- backend models/entities
- service layer responsibilities
- frontend components
- config loader/parser
- unlock evaluation logic
- donation transaction logic
- reward granting flow
- sample TypeScript interfaces if appropriate
- sample SQL schema if appropriate

### 10. Important requirements
Keep these requirements in mind:
- system must be **fully config-driven**
- easy to expand with new branches/nodes
- guild members donate **Ducats**
- research is **guild-wide**
- tree starts in the **center of a square UI background**
- there are **multiple outward branches**
- UI must be designed, not ignored
- backend + DB must be covered, not ignored
- make it scalable and maintainable
- avoid hardcoding the tree into UI or DB logic

### 11. Delivery style
Be highly structured and practical.
Think like a senior engineer handing this to a development team.
Do not stay high level.
Where useful, include tables, schemas, TypeScript types, SQL examples, and pseudocode.
Call out assumptions clearly.
Recommend the best design choices, not just all possibilities.

At the end, include:
- a **recommended MVP scope**
- a **phase 2 enhancement list**
- a **risk list / technical pitfalls**
- a **testing checklist**

If something is ambiguous, make reasonable assumptions and proceed without stopping.