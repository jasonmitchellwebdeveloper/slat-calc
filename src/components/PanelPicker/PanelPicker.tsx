import type { Dispatch } from "react";
import {
  PANEL_FENCE_HEIGHTS,
  PANEL_POST_LENGTHS,
  SLEEPER_HEIGHT_MM,
} from "@/engine/panelCatalogue";
import { recommendedPostLength } from "@/engine/panelBom";
import type { PanelDesign, PanelProfile } from "@/engine/types";
import type { DesignAction } from "@/lib/designReducer";
import { OptionGroup, type Option } from "../OptionGroup/OptionGroup";
import styles from "./PanelPicker.module.scss";

interface PanelPickerProps {
  design: PanelDesign;
  dispatch: Dispatch<DesignAction>;
}

const RECOMMENDED = "recommended";

const HEIGHT_OPTIONS: Option<string>[] = PANEL_FENCE_HEIGHTS.map((mm) => ({
  value: String(mm),
  label: `${mm} mm`,
}));

const SLEEPER_OPTIONS: Option<string>[] = [
  { value: "0", label: "None" },
  { value: "1", label: `1 (${SLEEPER_HEIGHT_MM} mm)` },
  { value: "2", label: `2 (${2 * SLEEPER_HEIGHT_MM} mm)` },
];

const PROFILE_OPTIONS: Option<PanelProfile>[] = [
  { value: "sawtooth", label: "Sawtooth" },
  { value: "trimline", label: "Trimline" },
];

export function PanelPicker({ design, dispatch }: PanelPickerProps) {
  const aboveGroundMm =
    design.fenceHeightMm + design.sleepers * SLEEPER_HEIGHT_MM;
  const postOptions: Option<string>[] = [
    {
      value: RECOMMENDED,
      label: `${recommendedPostLength(design)} mm (recommended)`,
    },
    ...PANEL_POST_LENGTHS.filter(
      (mm) => mm >= aboveGroundMm && mm !== recommendedPostLength(design),
    ).map((mm) => ({ value: String(mm), label: `${mm} mm` })),
  ];

  return (
    <div className={styles.picker}>
      <OptionGroup
        legend="Panel height"
        name="panel-height"
        columns="row"
        options={HEIGHT_OPTIONS}
        value={String(design.fenceHeightMm)}
        onChange={(value) =>
          dispatch({ type: "setFenceHeight", mm: Number(value) })
        }
      />
      <OptionGroup
        legend="Sleepers under each panel"
        name="sleepers"
        columns="row"
        options={SLEEPER_OPTIONS}
        value={String(design.sleepers)}
        onChange={(value) =>
          dispatch({
            type: "setSleepers",
            sleepers: Number(value) as PanelDesign["sleepers"],
          })
        }
      />
      <div>
        <OptionGroup
          legend="Post length"
          name="post-length"
          columns="row"
          options={postOptions}
          value={
            design.postLengthMm === null
              ? RECOMMENDED
              : String(design.postLengthMm)
          }
          onChange={(value) =>
            dispatch({
              type: "setPostLength",
              mm: value === RECOMMENDED ? null : Number(value),
            })
          }
        />
        <p className={styles.note}>
          Use a shorter post when fixing to an existing structure.
        </p>
      </div>
      <OptionGroup
        legend="Sheet profile"
        name="profile"
        columns="row"
        options={PROFILE_OPTIONS}
        value={design.profile}
        onChange={(profile) => dispatch({ type: "setProfile", profile })}
      />
    </div>
  );
}
