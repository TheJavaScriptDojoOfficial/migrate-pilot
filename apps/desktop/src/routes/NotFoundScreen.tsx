import { Link } from 'react-router-dom';

import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { ROUTES } from '@shared/constants/routes';

export function NotFoundScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Not found"
        subtitle="The page you were looking for does not exist."
      />
      <div className="flex flex-1 items-center justify-center px-8 py-12">
        <EmptyState
          icon="help"
          title="404 — route not registered"
          description="This URL is not part of the V1 workflow. Head back to project selection to start a session."
          action={
            <Button asChild trailingIcon={<Icon name="arrow-right" />}>
              <Link to={ROUTES.projectSelection}>Go to Project Selection</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
