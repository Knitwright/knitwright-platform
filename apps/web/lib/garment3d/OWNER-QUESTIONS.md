# 3D preview: what is owed by the owner

- **A10, the verdict on the trial.** Look at `docs/owner/3d/` (the README there says what
  to look for). Accept, and step 9A continues with tasks 2 to 7. Reject, and the result is
  recorded in decision 0014 and the step moves to layer F. Nothing after task 1 is built
  until then.
- **Where it lives.** The trial puts a **Show in 3D** button under the drawing in the
  editor. Should it also be on the tech pack page, or only there?
- **How deep.** The front stands out 0.42 and the back 0.36 of the greatest distance from
  the edge (`FRONT_DEPTH` and `BACK_DEPTH` in `mesh.ts`). This is a look, not a
  measurement. Deeper or flatter?
- **Turning by itself.** The view turns slowly by itself until it is touched, unless the
  device asks for less motion. Keep that, or start still?
