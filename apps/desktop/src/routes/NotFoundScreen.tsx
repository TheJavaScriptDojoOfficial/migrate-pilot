import { Link } from 'react-router-dom';

import { PageHeader } from '@shared/ui/PageHeader';
import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';
import { ROUTES } from '@shared/constants/routes';

export function NotFoundScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Not found" subtitle="The page you were looking for does not exist." />
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          title="404"
          description="This route is not registered."
          action={
            <Button asChild>
              <Link to={ROUTES.projectSelection}>Go to Project Selection</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
