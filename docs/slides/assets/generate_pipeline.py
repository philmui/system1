"""Generate the standalone, accessible widescreen training-pipeline vector."""

from pathlib import Path
import base64

HERE = Path(__file__).resolve().parent
font = base64.b64encode((HERE / "fonts/Manrope.woff2").read_bytes()).decode()
svg = r'''<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="700" viewBox="0 0 1680 700" role="img" aria-labelledby="pipeline-title pipeline-desc">
<title id="pipeline-title">A proposed task-development pipeline for enterprise decisions</title>
<desc id="pipeline-desc">A versioned source snapshot contains only evidence available at each decision time. Related cases are grouped and split before augmentation. Separate solid green branches carry training data, development and validation data, and untouched locked test data. Training fits permitted components, with adaptation optional. Development separates calibration from gate selection and freezes the model, decision definitions, and workflow policy. Dashed purple arrows carry artifacts, not samples, from training into development and then into the locked evaluation. Passing offline gates qualifies the frozen workflow for a controlled randomized service pilot that measures quality, whole-service cost, and latency. Passing predefined pilot gates permits rollout. Dotted brown feedback enters only the next dataset. This is a proposed application development process, not a description of koa-action foundation-model training.</desc>
<defs>
  <style>
    @font-face { font-family: Manrope; src: url(data:font/woff2;base64,@@FONT@@) format('woff2'); font-weight: 200 800; }
    text { font-family: Manrope, Arial, sans-serif; fill:#243e42; }
    .heading { font-size:30px; font-weight:760; letter-spacing:-.7px; }
    .copy { font-size:26px; font-weight:520; letter-spacing:-.35px; }
    .legend { font-size:25px; font-weight:600; }
    .data { fill:none; stroke:#51776a; stroke-width:3; marker-end:url(#data-arrow); }
    .data-bus { fill:none; stroke:#51776a; stroke-width:3; }
    .artifact { fill:none; stroke:#737dac; stroke-width:3; stroke-dasharray:10 7; marker-end:url(#artifact-arrow); }
    .gate { fill:none; stroke:#243e42; stroke-width:3; marker-end:url(#gate-arrow); }
    .feedback { fill:none; stroke:#ad7357; stroke-width:3; stroke-dasharray:2 8; stroke-linecap:round; marker-end:url(#feedback-arrow); }
    .card { stroke:#243e42; stroke-opacity:.12; stroke-width:1.5; }
  </style>
  <marker id="data-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9Z" fill="#51776a"/></marker>
  <marker id="artifact-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9Z" fill="#737dac"/></marker>
  <marker id="gate-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9Z" fill="#243e42"/></marker>
  <marker id="feedback-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9Z" fill="#ad7357"/></marker>
</defs>

<rect width="1680" height="700" fill="#f7f8f3"/>

<!-- The legend distinguishes data, artifacts, release qualification, and feedback. -->
<path d="M42 32H89" class="data"/>
<text x="105" y="41" class="legend">Data</text>
<path d="M249 32H296" class="artifact"/>
<text x="312" y="41" class="legend">Artifacts</text>
<path d="M507 32H554" class="gate"/>
<text x="570" y="41" class="legend">Release gates</text>
<path d="M818 32H865" class="feedback"/>
<text x="881" y="41" class="legend">Future feedback</text>
<text x="1640" y="41" class="legend" text-anchor="end" fill="#52675f">Proposed workflow</text>

<!-- Preserved source and grouped split. -->
<rect x="40" y="80" width="375" height="140" rx="22" fill="#dfe4f4" class="card"/>
<text x="66" y="117" class="heading">Decision-time snapshot</text>
<text x="66" y="158" class="copy">Inputs stop at the decision</text>
<text x="66" y="195" class="copy">Versioned records + labels</text>
<path d="M415 150H478" class="data"/>

<rect x="485" y="80" width="560" height="140" rx="22" fill="#f5e6b9" class="card"/>
<text x="512" y="117" class="heading">Split before augmentation</text>
<text x="512" y="158" class="copy">Keep related cases in one partition</text>
<text x="512" y="195" class="copy">Freeze the split and record provenance</text>

<!-- Future feedback deliberately has no path into the current test or fit. -->
<rect x="1240" y="80" width="400" height="140" rx="22" fill="#f2d8cb" class="card"/>
<text x="1267" y="119" class="heading">Reviewed feedback</text>
<text x="1267" y="160" class="copy">Next dataset only</text>
<text x="1267" y="195" class="copy">Fresh evidence for new claims</text>

<!-- All three partitions receive separate sample branches. -->
<path d="M765 220V256M232 256H1390" class="data-bus"/>
<circle cx="765" cy="256" r="5" fill="#51776a"/>
<path d="M232 256V293" class="data"/>
<path d="M782 256V293" class="data"/>
<path d="M1390 256V293" class="data"/>

<rect x="40" y="300" width="385" height="180" rx="22" fill="#d3e8df" class="card"/>
<text x="66" y="339" class="heading">Train</text>
<text x="66" y="380" class="copy">Fit permitted components</text>
<text x="66" y="417" class="copy">Adaptation is optional</text>
<text x="66" y="454" class="copy">Augment within this split</text>

<path d="M432 389H514" class="artifact"/>

<rect x="520" y="300" width="525" height="180" rx="22" fill="#f5e6b9" class="card"/>
<text x="547" y="339" class="heading">Development / validation</text>
<text x="547" y="380" class="copy">Separate calibration from</text>
<text x="547" y="417" class="copy">gate selection; freeze artifacts</text>
<text x="547" y="454" class="copy">Model · definitions · policy</text>

<path d="M1052 389H1134" class="artifact"/>

<rect x="1140" y="300" width="500" height="180" rx="22" fill="#dfe4f4" class="card"/>
<path d="M1171 324V318a8 8 0 0 1 16 0v6M1168 324h22v20h-22z" fill="none" stroke="#243e42" stroke-width="2.3"/>
<text x="1207" y="339" class="heading">Locked test</text>
<text x="1167" y="380" class="copy">Evaluate the frozen workflow</text>
<text x="1167" y="417" class="copy">Untouched cases · no tuning</text>
<text x="1167" y="454" class="copy">Offline gates must pass</text>

<!-- Qualification is control flow: offline test cases do not become pilot traffic. -->
<path d="M1390 480V514H782V543" class="gate"/>

<rect x="520" y="550" width="525" height="120" rx="22" fill="#d3e8df" class="card"/>
<text x="547" y="590" class="heading">Randomized service pilot</text>
<text x="547" y="632" class="copy">Quality · whole-service cost · latency</text>
<path d="M1052 610H1134" class="gate"/>

<rect x="1140" y="550" width="500" height="120" rx="22" fill="#d3e8df" class="card"/>
<text x="1167" y="590" class="heading">Roll out when gates pass</text>
<text x="1167" y="632" class="copy">Otherwise revise and re-evaluate</text>

<!-- Returns reviewed production evidence to a later dataset version only. -->
<path d="M1640 610H1665V150H1647" class="feedback"/>

<text x="40" y="582" class="heading">Preserve the evidence.</text>
<text x="40" y="622" class="copy">Adapt only where supported.</text>
<text x="40" y="660" class="copy">Keep the test outside tuning.</text>
</svg>
'''.replace("@@FONT@@", font)
(HERE / "training-pipeline.svg").write_text(svg)
print(f"Wrote {HERE / 'training-pipeline.svg'} ({len(svg):,} characters)")
