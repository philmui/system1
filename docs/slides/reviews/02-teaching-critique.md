# V2 narrative review and focused V3 recommendations

Reviewed 2026-09-28 from `src/deck-v2.json`, including the revised 31-slide sequence, notes, and the proposed acceptance replacement in `research/acceptance-visual.json`. This is a narrative/content review; rendering, presenter synchronization, export, and source validation require their own checks.

The major V1 teaching problems are addressed. The account-access graph now has a success guard and a blocked path; the contract separates unclear language from invalid responses; node context is visible as explicit input views. The eight-event trace ends in an accepted outage handoff and honestly states that the case remains unresolved. The routing-stage cost model is now clearly separate from the later invoice explanation and exposes break-even and overhead. Splitting the pipeline into two focus views makes the methodology easier to teach without sacrificing its safeguards.

The proposed acceptance slide adds schematic range-versus-limit pictures and ties the result to the same invoice/outage ledger. It contains no measured intervals or empirical numbers. Its ordinary-language verdict—cost passes, quality remains uncertain, rollout waits—is an appropriate culmination of the tutorial.

## Fix before freezing V2

- Slide `gate` says “Review adds queue capacity and delay.” Replace it with **“Review consumes queue capacity and can add delay.”** The current sentence reverses the capacity consequence.
- Import `acceptance-visual.json` with its current 650px body height and check both 32px panel headings remain on one line. The diagrams have descriptive SVG labels and visible text at 26px or larger. This review does not substitute for the final rendered bounds check.

## Proportional V3 changes

1. **Name the two levels of coverage.** Slide `gate` measures accepted routing decisions, while the pilot concerns complete incoming cases. Label the first metric “Routing coverage” or “Auto-routed” and state in pilot notes: “Case automation counts cases completed without escalation; routing coverage counts accepted decisions.” This prevents the gate's favorable count from being mistaken for service completion. An accepted route can still lead to an unresolved case, as the worked trace now shows.

2. **Make the final build assignment concrete.** The close already recommends one bounded decision. Add a short presenter cue or companion handout assignment: “Draft the route question, one mixed/unclear example, the node's input view, the failure edge, and the full-case acceptance rule.” This asks learners to produce an inspectable artifact from the tutorial without introducing a fictional SDK or extending the slide count.

3. **Validate the static teaching states for every PPTX edition.** The HTML trace, gate, calculator, and reveal exercise rely on interaction. Each export should show a deliberate state: the ledger at accepted unresolved handoff; counts with the synthetic gate signal; the cost failure or clearly labeled example plus break-even; and the repaired transaction flow. Buttons in a PowerPoint screenshot should not be mistaken for working controls. Preserve the alternate states in speaker notes or a compact companion page. This is a meaningful V3 communication improvement now that PPTX is requested.

4. **Rehearse the evidence section as a sequence of questions.** Use the existing slides to ask: “What could the node see?” → “Which records must stay together?” → “What is frozen?” → “What evidence earns release?” Avoid reading the full protocol aloud. With the new acceptance slide at two minutes, the plan is approximately 34 minutes, leaving time for the controls, exercise, and questions within a 40-minute session.

5. **Keep the trace's unresolved ending as an intentional lesson.** It now supplies the right counterexample for whole-case economics and acceptance. At the handoff, say explicitly: “We have demonstrated preservation of work and a controlled handoff; the service still owes the customer an outage outcome.” A final false success state would weaken the rigor of the story.

No new research section, benchmark slide, broad architecture rewrite, or additional statistical machinery is needed. The final version should deepen the existing worked example and prove that its visual, interactive, and exported forms convey the same meaning.
