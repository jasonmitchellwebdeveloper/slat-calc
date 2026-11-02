import { useEffect, useRef, useState } from "react";
import type { Design } from "@/engine/types";
import { designSearch } from "@/lib/designUrl";
import { Button } from "../Button/Button";
import styles from "./CopyLinkButton.module.scss";

interface CopyLinkButtonProps {
  design: Design;
  disabled: boolean;
}

const MESSAGE_MS = 2500;

export function CopyLinkButton({ design, disabled }: CopyLinkButtonProps) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Built from the design, not the address bar, which lags behind by a debounce.
  async function copy() {
    const { origin, pathname } = window.location;
    let next = "Link copied";
    try {
      await navigator.clipboard.writeText(
        `${origin}${pathname}${designSearch(design)}`,
      );
    } catch {
      next = "Couldn't copy. Use the address bar instead.";
    }
    setMessage(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), MESSAGE_MS);
  }

  return (
    <div className={styles.copy}>
      <Button disabled={disabled} onClick={copy}>
        Copy link to this design
      </Button>
      {/* Always rendered, so screen readers announce the message when it fills. */}
      <p className={styles.message} role="status">
        {message}
      </p>
    </div>
  );
}
