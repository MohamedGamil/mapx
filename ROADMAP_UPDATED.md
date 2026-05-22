# MapxGraph — Comprehensive Project Roadmap

> **Last updated:** 2026-05-22  
> **Scope:** 28 features across 15 iterations  
> **Based on:** Complete review of specs/ directory  

---

## Executive Summary

MapxGraph is a local code-graph memory tool that scans source files, extracts symbols and dependencies, builds a weighted graph with PageRank scoring, and exposes the result through a CLI and MCP server. This roadmap presents a refined development plan based on thorough analysis of all specifications, addressing duplicates, conflicts, unrealistic expectations, and alignment issues identified during review.

---

## Key Improvements from Original Roadmap

1. **Resolved Schema Version Conflicts**: Established canonical version sequence (v3→v4→v5→v6)
2. **Adjusted Scope for Expansion Features**: Recommended incremental approach for language/framework support
3. **Clarified Dependencies**: Fixed incorrect dependency claims (e.g., F08/F09 no longer incorrectly depend on F06)
4. **Enhanced Risk Assessment**: Identified and documented high-risk iterations with mitigation strategies
5. **Improved Readiness Assessment**: Separated "ready for implementation" features from those needing refinement

---

## Refined Development Strategy

### Phase-Based Approach

Instead of strictly sequential iterations, we recommend a **phase-based approach** that maximizes parallel work while respecting true dependencies:

#### Phase 1: Foundation (Can run in parallel)
- **I01**: Schema migration + parser edge labelling (F01)
- **I02**: Glob filter pipeline (F03) 
- **I04**: PHP parser fundamentals (F05, F06, F10)
- **I07**: npm distribution & Node.js DX (F13)

#### Phase 2: Core Features (After Phase 1 prerequisites)
- **I03**: CLI + MCP surface (F02, F04) - requires I01
- **I05**: Laravel structural patterns (F07, F08, F09) - requires I04
- **I08**: Code structure, clusters & data flow (F14, F15, F16) - requires I01

#### Phase 3: Laravel Completion & Context
- **I06**: Laravel advanced patterns (F11, F12) - requires I04,I05
- **I09**: LLM agent integration files (F17) - enriched by I08,I10
- **I10**: Git workspace & submodule awareness (F18) - requires I08
- **I11**: Smart context & search tools (F19) - requires I03,I08

#### Phase 4: Language Expansion (Sequential)
- **I12**: Language expansion (F20) - independent but large scope
  - **Recommended**: Implement in sub-phases (5 languages at a time)

#### Phase 5: Framework Support (After language foundation)
- **I13**: Framework-aware parsing (F21-F26) - requires I12 for non-PHP/JS/TS frameworks
  - **Recommended**: Start with concrete implementations, extract patterns, then build infrastructure

#### Phase 6: Polish & UX
- **I14**: TOON export format (F27) - independent
- **I15**: Bundled web dashboard (F28) - requires I07

---

## Detailed Iteration Plan with Adjusted Scoping

### I01 — Schema Migration + Parser Edge Labelling
**Status**: Ready for implementation  
**Risk**: Low  
**Deliverables**: 
- `ALTER TABLE edges ADD COLUMN verifiability TEXT DEFAULT 'verified'`
- Parser updates for PHP, JS, TS to label edges as verified/inferred
- Common-method filter list implementation
- `mapx metrics --verified-only` flag

### I02 — Glob Filter Pipeline  
**Status**: Ready for implementation  
**Risk**: Low  
**Deliverables**:
- `--include` / `--exclude` glob patterns for scan/update/export
- Discovery-time filtering (zero I/O cost for excluded files)
- Config persistence in `.mapx/config.json`

### I03 — CLI + MCP Surface (metrics, edges)
**Status**: Ready for implementation (after I01)  
**Risk**: Low  
**Deliverables**:
- `mapx metrics` command with coupling/instability reports
- `mapx edges` command for granular edge querying
- Corresponding MCP tools: `mapx_metrics`, `mapx_edges`

### I04 — PHP Parser Fundamentals
**Status**: Ready for implementation  
**Risk**: Medium  
**Deliverables**:
- FQN resolution from `use` import declarations (F05)
- Type-hint dependency edges (param_type/return_type) (F06)  
- Laravel-aware scan exclusions (vendor/, bootstrap/cache/, etc.) (F10)
- UsageImportTable class implementation

### I05 — Laravel Structural Patterns
**Status**: Ready for implementation (after I04)  
**Risk**: Medium  
**Deliverables**:
- Eloquent relationship edges (hasMany, belongsTo, etc.) (F07)
- Route-to-controller binding edges (F08)
- IoC service container binding edges (F09)
- All features depend only on F05 FQN resolution, not F06

### I06 — Laravel Advanced Patterns
**Status**: Ready for implementation (after I04,I05)  
**Risk**: Medium  
**Deliverables**:
- Facade resolution (static map to concrete services) (F11)
- Event/job/notification dispatch edges (F12)
- Dispatch/fires/listens_to/notifies/queues edge types

### I07 — npm Distribution & Node.js DX
**Status**: Ready for implementation  
**Risk**: Low  
**Deliverables**:
- npm package publication with `bin: { mapx }`
- Node.js SQLite fallback via better-sqlite3
- Installer script and AGENTS.md injection at `mapx init`
- Node 20+ LTS requirement

### I08 — Code Structure, Clusters & Data Flow
**Status**: Needs refinement  
**Risk**: HIGH  
**Deliverables**:
- Cluster detection via namespace, directory, and community detection
- Schema migration: clusters, cluster_membership tables + namespace column
- `mapx clusters` CLI command and MCP tool
- Cluster-aware DOT/SVG export with subgraph rendering
- Data flow tracing (`mapx trace <symbol>`) with source/sink detection
- **Recommendation**: Consider splitting into sub-iterations due to high complexity

### I09 — LLM Agent Integration Files
**Status**: Ready for implementation  
**Risk**: Low  
**Deliverables**:
- `mapx agents` command group (generate, list, update)
- Provider-specific templates for 10+ LLM/Cursor/Copilot/etc.
- Version sentinel comments for update detection
- MCP tool for agent file generation

### I10 — Git Workspace & Submodule Awareness
**Status**: Ready for implementation (after I08)  
**Risk**: Medium  
**Deliverables**:
- WorkspaceManager for submodule, peer repo, and VS Code workspace detection
- Per-repo scan isolation with independent blob hash tracking
- Cross-repo edge tracking with source_repo/target_repo fields
- `mapx workspaces` command group and `--all` flags
- Schema migration: `ALTER TABLE edges ADD COLUMN target_repo TEXT`

### I11 — Smart Context & Search Tools
**Status**: Ready for implementation  
**Risk**: Medium  
**Deliverables**:
- ContextBuilder class for task-focused context assembly
- New tools: mapx_search, mapx_callers, mapx_callees, mapx_impact, mapx_node, mapx_files
- Enhanced mapx_status with language breakdown and stale detection
- **Note**: mapx_status text format change is a breaking change

### I12 — Language Expansion (19 Languages)
**Status**: Needs scoping adjustment  
**Risk**: HIGH  
**Deliverables**:
- GenericWasmParser base class for language expansion
- Language tier system: built-in, bundled, installable, user
- WASM fetch/cache infrastructure in ~/.mapx/grammars/
- **Recommendation**: Implement in phases:
  - Phase 1: Python, Go, Rust, Java, C# (built-in)
  - Phase 2: Ruby, C, C++, Swift, Kotlin (bundled)  
  - Phase 3: Remaining 10 languages (installable via mapx lang install)

### I13 — Framework-Aware Parsing & Route Context
**Status**: Needs scoping adjustment  
**Risk**: HIGH  
**Deliverables**:
- FrameworkDetector abstraction and RouteRegistry
- mapx routes CLI command and MCP tool
- Framework-specific detectors for 21 frameworks across 5 specs
- Schema migration: `ALTER TABLE edges ADD COLUMN metadata TEXT`
- **Recommendation**: 
  1. Implement 2-3 concrete detectors first (Django, Express, Laravel)
  2. Extract common patterns from implementations
  3. Build FrameworkDetector infrastructure based on observed patterns
  4. Expand to additional frameworks incrementally

### I14 — TOON Export Format
**Status**: Ready for implementation  
**Risk**: Low  
**Deliverables**:
- TOON v3.3 export format (token-efficient alternative to JSON)
- ToonExporter class with key folding and tabular arrays
- --format=toon flag for mapx export and MCP tool
- Optional --delimiter and --key-folding flags

### I15 — Bundled Web Dashboard
**Status**: Ready for implementation (after I07)  
**Risk**: Medium  
**Deliverables**:
- Self-contained web dashboard via `mapx ui`
- Graph exploration with Cytoscape.js (force-directed layout)
- Symbol explorer table with search/sort/filter
- Live MCP tool-call log via SSE
- Metrics panel with PageRank and coupling charts
- Context viewer (when F11 available)
- Security: 127.0.0.1 binding, rate limiting, response size limits

---

## Risk Mitigation Strategies

### High-Risk Iterations (I08, I12, I13)

**I08 - Clusters & Data Flow**:
- Implement Label Propagation with deterministic seeding
- Add depth limits and performance guards for data flow tracing
- Consider splitting cluster detection (F14) from data flow (F16)

**I12 - Language Expansion**:
- Implement incrementally (5 languages per sub-iteration)
- Set WASM bundle size budgets per parser
- Prioritize languages with mature tree-sitter grammars
- Create per-language test corpora early

**I13 - Framework Support**:
- Start with concrete implementations before abstraction
- Use regex-based extraction initially for rapid iteration
- Extract FrameworkDetector interface after 2-3 implementations
- Add framework detection confidence scoring to reduce false positives

### Breaking Changes
- **I11**: mapx_status text format change - document clearly, provide migration notes
- All schema migrations are forward-only; use git to revert features if needed

---

## Dependency Verification

All dependencies have been verified and corrected:

### Corrected Dependencies:
- **F08/F09**: No longer incorrectly depend on F06 (type hints) - they use string literals and ::class constants
- **F11**: No longer incorrectly depends on F09 (binding table) - uses static facade map
- **Schema Versions**: Canonical sequence established (v3→F01, v4→F14, v5→F18, v6→F21)

### Valid Dependencies:
- **F02 → F01**: Metrics needs verifiability for --verified-only filtering
- **F05 → F06**: Type hints need use-import table for FQN resolution  
- **F04 → Independent**: Edge querying works on base graph
- **F14 → Benefits from F05**: Better clusters with accurate PHP namespaces
- **F16 → Enriched by F07-F12**: Richer traces with Laravel dispatch/route edges
- **F21 → Prerequisite for F22-F26**: Framework infrastructure needed first
- **F22-F26 → Benefit from F12**: Non-PHP/JS/TS frameworks need language parsers

---

## Success Metrics

### Technical Quality:
- All features implementable with clear acceptance criteria
- TypeScript type safety maintained throughout
- Semantic versioning for API stability
- Comprehensive test coverage targets (>80%)

### Operational Excellence:
- Backup/recovery procedures for .mapx database
- Configuration validation at startup
- Progressive error messages with recovery suggestions
- Performance benchmarks for various codebase sizes

### User Value:
- Immediate value from core features (I01-I04, I08)
- Incremental delivery of advanced capabilities
- Clear upgrade path with documented migration steps
- Backward compatibility maintained where possible

---

## Conclusion

This refined roadmap maintains the ambitious vision of MapxGraph while addressing practical implementation concerns. By adjusting scope for expansion features, clarifying dependencies, and identifying risks with mitigation strategies, the project can deliver consistent value to users while building toward its full potential.

The recommended phase-based approach allows for parallel workstreams while respecting true technical dependencies, ensuring steady progress toward becoming a comprehensive developer intelligence tool.

---

*This document supersedes the original ROADMAP.md and should be used as the definitive implementation guide.*