---
name: ddd-review
description: |
  Review code base from the viewpoint of Domain Driven Design (DDD) specialist.
  Evaluate how core business logics are well organized in terms of DDD principle.
allowed-tools:
  - Read
  - Grep
  - Glob
---

First read the code base. Detect core business logic. Check if the business logic are implemented in DDD pattern languages.

The DDD Pattern languages include:
- Domain Models
- Repository pattern - used when domain models are persisted in external storage
- Service pattern - used when multiple domain models interact
- Aggregate pattern - used when multiple domain models form another aggregated model
- The code base is aware of Ubiquitous Language and it uses the language in a consistent way (The same model always called by the same name. No ambiguous mentioning of the same concept)

Evaluate the overall score of how much the code base confirms to DDD principle from 0 to 10.
- 0 - no meaningful domain models at all
- 2 - uses some classes for some data structure, but doesn't reflect ubiquitous language
- 4 - There are some domain models (or domain model-like classes) defined, but there are more unstructured data reamining. Interactions do not follow DDD principle.
- 6 - Fair amount of data structures are expressed as domain models. Some interaction implementation follow DDD principle. However there remain many unstructured data which are processed unprincipled way
- 8 - Most data are represented as domain models, but interactions are not fully conformant to DDD principle
- 10 - completely follow DDD principle

