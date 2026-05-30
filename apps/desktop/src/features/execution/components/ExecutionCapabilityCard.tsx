import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import type { MigrationStep } from '@features/migration-plan';

import { getExecutorEntry } from '../services/executorRegistry';
import type { ExecutionCapability } from '../types/execution.types';

/**
 * ExecutionCapabilityCard — surfaces executor availability for the
 * currently selected plan step plus a clear safety notice.
 *
 * Visual states (driven by capability.badge, NOT by step id):
 *
 *   - Capability not yet probed → "Verify executor" CTA (scripted only).
 *   - Probed + executable       → green executor badge with reason.
 *   - Manual / validation / AI / unsupported / missing metadata
 *                               → warning state with explanatory copy
 *                                 and no run / verify actions.
 */
export interface ExecutionCapabilityCardProps {
  readonly step: MigrationStep;
  readonly capability: ExecutionCapability | undefined;
  readonly canVerify: boolean;
  readonly verifying: boolean;
  readonly onVerify: () => void;
}

export function ExecutionCapabilityCard({
  step,
  capability,
  canVerify,
  verifying,
  onVerify,
}: ExecutionCapabilityCardProps): JSX.Element {
  const isExecutable = capability?.executable === true;
  const verified = capability !== undefined;
  const executorKey =
    capability?.executorKey ?? step.execution?.executorKey;
  const executorEntry = getExecutorEntry(executorKey);
  const executorLabel = executorEntry?.label ?? 'Generic executor';
  const isScriptedCandidate =
    step.execution?.mode === 'scripted' &&
    executorEntry !== undefined &&
    executorEntry.supported;
  const showVerifyButton = isScriptedCandidate && !isExecutable;

  return (
    <Card accent={isExecutable}>
      <CardHeader>
        <div>
          <CardTitle>Selected step</CardTitle>
          <CardDescription>{step.title}</CardDescription>
        </div>
        {isExecutable ? (
          <Badge tone="success" variant="soft" withDot>
            {executorLabel} available
          </Badge>
        ) : verified ? (
          <Badge tone="warning" variant="soft" withDot>
            Not executable
          </Badge>
        ) : (
          <Badge tone="neutral" variant="outline">
            Capability not verified
          </Badge>
        )}
      </CardHeader>

      <CardSection label="Executor">
        <div className="flex flex-col gap-2 text-xs text-ink-muted">
          {isExecutable ? (
            <p className="leading-relaxed">
              The <strong>{executorLabel}</strong> executor will run for this
              step. It writes only inside{' '}
              <code className="font-mono">workspace</code>; no package
              manager command is run, no lock file is updated, and no commit
              is created.
            </p>
          ) : verified ? (
            <p className="leading-relaxed">{capability?.reason}</p>
          ) : step.execution === undefined ? (
            <p className="leading-relaxed">
              This step has no execution metadata. The plan generator did
              not declare an executor for it; treat it as manual.
            </p>
          ) : (
            <p className="leading-relaxed">
              Executor availability is verified against the actual workspace
              before any mutation is allowed. Run the verification to confirm
              this step can execute right now.
            </p>
          )}
          {capability?.missingRequirements !== undefined &&
          capability.missingRequirements.length > 0 ? (
            <ul className="list-inside list-disc text-2xs leading-relaxed">
              {capability.missingRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          ) : null}
          {showVerifyButton ? (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="scan" />}
              onClick={onVerify}
              disabled={!canVerify || verifying}
              loading={verifying}
            >
              {verifying ? 'Verifying' : verified ? 'Re-verify executor' : 'Verify executor'}
            </Button>
          ) : null}
        </div>
      </CardSection>

      <CardSection label="Safety notice">
        <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success-soft px-3 py-2.5">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
            <Icon name="shield" className="h-3 w-3" />
          </span>
          <p className="text-2xs leading-relaxed text-ink-muted">
            This action modifies only the migration workspace, not the
            original project.
          </p>
        </div>
      </CardSection>
    </Card>
  );
}
