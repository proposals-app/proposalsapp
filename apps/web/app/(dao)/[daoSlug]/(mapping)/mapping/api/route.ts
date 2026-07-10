import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { mappingRequestSchema } from '../api-contract';
import {
  createGroup,
  deleteGroup,
  fuzzySearchItems,
  saveGroups,
} from '../actions';
import {
  createDelegate,
  deleteDelegate,
  fuzzySearchDiscourseUsers,
  fuzzySearchVoters,
  mapDiscourseUserToDelegate,
  mapVoterToDelegate,
  unmapDiscourseUserFromDelegate,
  unmapVoterFromDelegate,
} from '../delegates/actions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ daoSlug: string }> }
) {
  try {
    assertSameOrigin(request);
    const input = mappingRequestSchema.parse(await request.json());
    const { daoSlug } = await params;

    switch (input.operation) {
      case 'groups.search':
        return success(await fuzzySearchItems(input.query, daoSlug));
      case 'groups.save':
        await saveGroups(daoSlug, input.groups);
        return success(null);
      case 'groups.create':
        await createGroup(daoSlug);
        return success(null);
      case 'groups.delete':
        await deleteGroup(daoSlug, input.groupId);
        return success(null);
      case 'delegates.searchDiscourseUsers':
        return success(
          await fuzzySearchDiscourseUsers(
            daoSlug,
            input.query,
            input.excludeIds
          )
        );
      case 'delegates.searchVoters':
        return success(
          await fuzzySearchVoters(daoSlug, input.query, input.excludeIds)
        );
      case 'delegates.mapDiscourseUser':
        await mapDiscourseUserToDelegate(
          daoSlug,
          input.delegateId,
          input.discourseUserId
        );
        return success(null);
      case 'delegates.unmapDiscourseUser':
        await unmapDiscourseUserFromDelegate(
          daoSlug,
          input.delegateId,
          input.discourseUserId
        );
        return success(null);
      case 'delegates.mapVoter':
        await mapVoterToDelegate(daoSlug, input.delegateId, input.voterId);
        return success(null);
      case 'delegates.unmapVoter':
        await unmapVoterFromDelegate(daoSlug, input.delegateId, input.voterId);
        return success(null);
      case 'delegates.create':
        await createDelegate(daoSlug);
        return success(null);
      case 'delegates.delete':
        await deleteDelegate(daoSlug, input.delegateId);
        return success(null);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid mapping request' },
        { status: 400 }
      );
    }

    if (error instanceof CrossOriginRequestError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('Mapping request failed', error);
    return NextResponse.json(
      { error: 'Mapping request failed' },
      { status: 500 }
    );
  }
}

function success<T>(data: T) {
  return NextResponse.json({ data });
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');
  if (!host || new URL(origin).host !== host) {
    throw new CrossOriginRequestError();
  }
}

class CrossOriginRequestError extends Error {
  constructor() {
    super('Cross-origin mapping requests are not allowed');
  }
}
