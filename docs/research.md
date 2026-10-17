# Research notes

## RPSS: near/far targets and the trunk rule (D4)

### Source

Levin MF, Desrosiers J, Beauchemin D, Bergeron N, Rochette A. Development and validation of a scale for rating motor compensations used for reaching in patients with hemiparesis: the Reaching Performance Scale. *Phys Ther.* 2004;84(1):8–22. doi:10.1093/ptj/84.1.8

The paper calls it the Reaching Performance Scale (RPS). Later papers call it the RPSS ("for Stroke"); we use RPSS.

### Target placement (p. 11)

| Setting | RPSS value |
|---|---|
| Chair | 42 cm seat, backrest not used, no armrests; feet flat |
| Table | 72 cm high |
| Chair distance | The chair is placed so that, with the arm fully extended, the distal wrist crease lines up with a mark **4 cm** from the table's front edge |
| Start position | Both arms alongside the body, not resting on the table or lap |
| Object | Cardboard cone, 7 cm base, 17.5 cm high, on the trunk midline |
| **Near (close) target** | Cone **1 cm** from the table's front edge |
| **Far target** | Cone **30 cm** from the table's front edge |

What the two distances mean for the body (p. 11):

- **Near:** an unimpaired person can grasp the cone with the arm flexed and **no forward trunk movement**.
- **Far:** an unimpaired person needs forward trunk movement of **about 25% of the reaching distance** (from the starting hand position to the cone).

**RPSS gives fixed distances, not fractions of arm length.** The arm-length scaling is done by the chair distance: the near cone sits 3 cm short of the extended wrist crease, and the far cone sits 26 cm beyond it. Any `NEAR_RATIO`/`FAR_RATIO` would therefore be our invention. PLAN.md §20 accepts the RPSS setup as is, and `config.ts` holds it as `RPSS_WRIST_MARK_CM`, `RPSS_NEAR_CM` and `RPSS_FAR_CM`.

### Trunk rule

The scale scores trunk displacement 0–3 with **different criteria for each target** (p. 12 and the Appendix, p. 22).

| Score | Close target | Far target |
|---|---|---|
| 3 | "No or almost no forward trunk displacement" | "Appropriate forward trunk displacement related to the amount of elbow extension" |
| 2 | Small trunk displacement (flexion, rotation, or both) | Excessive trunk displacement because elbow or shoulder movement is limited |
| 1 | More than half the movement is made by the trunk | Excessive: about half of the hand's displacement comes from the trunk, but the hand reaches the target |
| 0 | The task is done only by forward trunk displacement | Excessive: more than three-quarters of the hand's displacement comes from the trunk, and the hand doesn't reach the target |

The paper's rationale (p. 12): for the far target, trunk displacement counts as adequate if the elbow is almost fully extended at the moment of grasping. If the trunk moved too much, the elbow stays flexed. If the trunk moved too little, the hand can't get close enough to grasp.

**What this means for TrueReach:**

- **Near target:** any forward lean is a compensation. This matches `checks.lean = 'near_only'`.
- **Far target:** lean is *expected* (about 25% of the reach) and only becomes a compensation when it replaces elbow extension. Our current rule, "never flag lean on far targets", is a simplification. It misses the excessive far-target lean that RPSS scores 0–2. A closer rule would flag far-target lean only when the elbow isn't almost fully extended at the touch. That would need a §20 proposal, since it touches `rules.ts` (pool) and the `ExerciseProfile` lean modes.

### Other RPSS numbers worth keeping

From pp. 12–13 (citing the authors' kinematic studies):

| Movement | Near | Far |
|---|---|---|
| Shoulder flexion needed | about 20° | about 40° |
| Shoulder horizontal adduction needed | about 40° | about 40° |
| Elbow extension needed | about 80° | about 100° |

- **Camera:** RPSS raters watched video filmed at 45° between the frontal and sagittal planes, on the hemiparetic side (p. 12). TrueReach uses a pure side view (§9.1 S2).
- **Reliability:** the trunk displacement item had good agreement between raters (weighted kappa 0.58–0.74; p. 18, Table 7).

### Differences from TRSP

TRSP (our threshold and model data) recorded forward reaches pushing a robot handle that supported the arm. It has no near/far split. Healthy TRSP reaches labeled clean show almost no lean (median `leanDeg` 0.0°; `docs/results.md`, D2), like the RPSS near target. That's consistent with applying the TRSP-fitted lean threshold to near targets only.
