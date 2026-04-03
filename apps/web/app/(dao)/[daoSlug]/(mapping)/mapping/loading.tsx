import { Spinner } from '@/app/components/ui/spinner';

export default function Loading() {
  return (
    <div className='container mx-auto flex min-h-[50vh] items-center justify-center p-6'>
      <Spinner size='lg' />
    </div>
  );
}
