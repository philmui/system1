# Interface inspection captures

These screenshots show application state derived from persisted events. The fixture walkthrough is labeled **Simulated**; its artificial provider delays are not performance measurements. The separate **Live** captures show the later bounded synthetic comparison recorded in [the timing results](../latency-results.json). Desktop fixture captures use a 1512 × 1000 viewport; narrow captures use 390 × 844. Full-page captures extend below the viewport.

| Capture | Mode | What it shows |
| --- | --- | --- |
| [Library](library-desktop.png) | Simulated | Fourteen synthetic documents, readable/extraction states, and three selected inputs. |
| [Classification workspace](run-desktop.png) | Simulated | Three workers, an inspectable Choice signal, and a checkpointed parent review. |
| [Comparison and replay](discovery-desktop.png) | Simulated | Two retrieval workers, citation-bearing results, and recorded replay controls. |
| [Timing and answer formation](latency-formation.png) | Simulated | Candidate, evidence, draft, and validation counts above overlapping execution lanes. |
| [Expanded retrieval workers](expanded-workers.png) | Simulated | Separate retrieval and evidence-screening steps within each runtime worker. |
| [Anchored source](source-desktop.png) | Simulated | A citation opens the retained passage and highlights the exact quotation. |
| [Narrow run workspace](run-mobile.png) | Simulated | The inspector and linear event list remain available below the canvas. |
| [Narrow discovery form](discover-mobile.png) | Simulated | Query entry and structured filters at a phone-sized width. |
| [Narrow results](results-mobile.png) | Simulated | Retained claims and source links remain readable at a phone-sized width. |
| [Live timing and formation](latency-live-desktop.png) | Live | The recorded plan, evidence gates, provider request durations, and parallel retrieval work. |
| [Live component measurements](latency-live-components.png) | Live | Individual request/stage measurements, queue waits, attempts, and deterministic policy time. |
| [Narrow live measurements](latency-live-mobile.png) | Live | The same saved live measurements and formation stages on a narrow screen. |

Regenerate the simulated captures by running `npm test --prefix frontend` from the repository root after installing Playwright Chromium. The test launches isolated fixture services on backend port 8001 and frontend port 5173; stop a development frontend using that port first. The live captures require opening the retained live run; replay and screenshots do not repeat its provider calls. See [reading a run](../reading-a-run.md) for measurement boundaries and the distinction between accumulated request duration and wall time.
