"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/primitives";

/**
 * Persona picker for the mock consent screen. Posts a plain HTML form to the
 * mock provider, which redirects to the app's real callback with code + state.
 */
export default function MockConsentForm({
  action,
  redirectUri,
  state,
  personas,
}: {
  action: string;
  redirectUri: string;
  state: string;
  personas: { name: string; hue: number; avatar: string }[];
}) {
  const [picked, setPicked] = useState(0);
  const persona = personas[picked] ?? personas[0]!;

  return (
    <form action={action} method="post">
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="nickname" value={persona.name} />
      <input type="hidden" name="hue" value={persona.hue} />

      <p className="section-label" id="persona-label">
        选择一个示例身份
      </p>
      <div role="radiogroup" aria-labelledby="persona-label">
        {personas.map((p, i) => (
          <button key={p.name} type="button" role="radio" aria-checked={picked === i} className={`persona ${picked === i ? "selected" : ""}`} onClick={() => setPicked(i)}>
            <Avatar name={p.name} src={p.avatar} size="lg" />
            <div className="flex1">
              <strong>{p.name}</strong>
              <p className="caption">Mock 测试用户 · 资料仅供演示</p>
            </div>
            <span className="radio" aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="auth-actions">
        <button type="submit" className="btn" name="decision" value="deny">
          取消授权
        </button>
        <button type="submit" className="btn primary" name="decision" value="allow">
          确认模拟授权
        </button>
      </div>
      <p className="secure-note">
        <Icon name="lock" />
        回到应用后，服务端仍会校验 OAuth state
      </p>
    </form>
  );
}
