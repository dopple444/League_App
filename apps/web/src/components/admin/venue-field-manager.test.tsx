import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, browserApi, type FieldAdmin, type VenueAdmin } from '../../lib/api-client';
import { VenueFieldManager } from './venue-field-manager';

const organizationId = '89a6be95-5190-44bb-9cd0-b9bf089abcc9';
const venueId = '47e315cb-aa01-42df-a0b0-f95a9f1d32da';
const fieldId = '66e3ae38-142e-4b1c-8671-f6000788f4e7';

const field: FieldAdmin = {
  organizationId,
  venueId,
  fieldId,
  name: 'Field One',
  publicDirections: 'Use the east entrance by the shelter.',
  hasLights: true,
  fenceDistanceFeet: 300,
  active: true,
  version: 2,
  createdAt: '2026-08-21T12:00:00.000Z',
  updatedAt: '2026-08-21T12:30:00.000Z',
};

const venue: VenueAdmin = {
  organizationId,
  venueId,
  name: 'Demo Parks Complex',
  active: true,
  version: 3,
  createdAt: '2026-08-21T11:00:00.000Z',
  updatedAt: '2026-08-21T12:30:00.000Z',
  fields: [field],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VenueFieldManager', () => {
  it('renders a keyboard-operable venue accordion and complete nested field details', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([venue]);

    render(<VenueFieldManager organizationId={organizationId} />);

    const venueName = await screen.findByText('Demo Parks Complex');
    const summary = venueName.closest('summary');
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText('1 field')).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText('active')).toBeInTheDocument();

    await user.click(summary as HTMLElement);

    const table = screen.getByRole('table', { name: 'Fields at Demo Parks Complex' });
    expect(within(table).getByText('Field One')).toBeInTheDocument();
    expect(within(table).getByText('Available')).toBeInTheDocument();
    expect(within(table).getByText('300 ft')).toBeInTheDocument();
    expect(within(table).getByText('Use the east entrance by the shelter.')).toBeInTheDocument();
    expect(within(table).queryByRole('link', { name: /east entrance/i })).not.toBeInTheDocument();
  });

  it('validates a venue, prevents duplicate submission, announces success, and restores focus', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([]);
    const createdVenue: VenueAdmin = {
      ...venue,
      name: 'Riverside Park',
      version: 1,
      fields: [],
    };
    let resolveCreate: (value: VenueAdmin) => void = () => undefined;
    const createVenue = vi.spyOn(browserApi, 'createVenue').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<VenueFieldManager organizationId={organizationId} />);
    await screen.findByRole('heading', { name: 'Add your first venue' });
    await user.click(screen.getByRole('button', { name: 'Add Venue' }));

    const submit = screen.getByRole('button', { name: 'Add venue' });
    expect(screen.getByLabelText('Venue name (required)')).toBeRequired();
    await user.click(submit);
    const errorSummary = screen.getByRole('alert');
    expect(errorSummary).toHaveFocus();
    expect(screen.getByLabelText('Venue name (required)')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Venue name (required)'), 'Riverside Park');
    expect(screen.queryByText('Enter a name.')).not.toBeInTheDocument();
    await user.click(submit);

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Venue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add your first venue' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Adding…' }));
    expect(createVenue).toHaveBeenCalledTimes(1);
    expect(createVenue).toHaveBeenCalledWith(
      organizationId,
      {
        name: 'Riverside Park',
        active: true,
      },
      expect.any(String),
    );
    await act(async () => {
      resolveCreate(createdVenue);
      await Promise.resolve();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Riverside Park was added.');
    const savedSummary = screen.getByText('Riverside Park').closest('summary');
    await waitFor(() => expect(savedSummary).toHaveFocus());
  });

  it('reuses an idempotency key for an unchanged venue retry and rotates it for changed input', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([]);
    const networkError = new ApiError(0, {
      code: 'NETWORK_UNAVAILABLE',
      message: 'The connection ended before the result was known.',
      requestId: 'synthetic-network-request',
    });
    const createVenue = vi
      .spyOn(browserApi, 'createVenue')
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue({
        ...venue,
        name: 'Retry Park Updated',
        version: 1,
        fields: [],
      });

    render(<VenueFieldManager organizationId={organizationId} />);
    await screen.findByRole('heading', { name: 'Add your first venue' });
    await user.click(screen.getByRole('button', { name: 'Add Venue' }));
    const panel = screen.getByRole('region', { name: 'Add venue' });
    const name = within(panel).getByLabelText('Venue name (required)');
    const submit = within(panel).getByRole('button', { name: 'Add venue' });
    await user.type(name, 'Retry Park');

    await user.click(submit);
    expect(await within(panel).findByRole('alert')).toHaveTextContent('result was known');
    const firstKey = createVenue.mock.calls[0]?.[2];
    expect(firstKey).toEqual(expect.any(String));

    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(createVenue).toHaveBeenCalledTimes(2));
    expect(createVenue.mock.calls[1]?.[2]).toBe(firstKey);

    await waitFor(() => expect(submit).toBeEnabled());
    await user.type(name, ' Updated');
    await user.click(submit);
    expect(await screen.findByRole('status')).toHaveTextContent('Retry Park Updated was added.');
    expect(createVenue.mock.calls[2]?.[2]).not.toBe(firstKey);
  });

  it('sends nullable field attributes and retains entered values after a stale-version conflict', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([venue]);
    const updateField = vi.spyOn(browserApi, 'updateField').mockRejectedValue(
      new ApiError(409, {
        code: 'VERSION_CONFLICT',
        message: 'Version conflict.',
        requestId: 'synthetic-request',
      }),
    );

    render(<VenueFieldManager organizationId={organizationId} />);
    const summary = (await screen.findByText('Demo Parks Complex')).closest('summary');
    await user.click(summary as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Edit Field One' }));

    const name = screen.getByLabelText('Field name (required)');
    await user.clear(name);
    await user.type(name, 'North Diamond');
    await user.clear(screen.getByLabelText('Public directions (optional)'));
    await user.clear(screen.getByLabelText('Fence distance in feet (optional)'));
    await user.click(screen.getByLabelText('Lights available'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateField).toHaveBeenCalledWith(
        organizationId,
        venueId,
        fieldId,
        {
          expectedVersion: field.version,
          name: 'North Diamond',
          publicDirections: null,
          hasLights: false,
          fenceDistanceFeet: null,
          active: true,
        },
        expect.any(String),
      ),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('changed elsewhere');
    expect(name).toHaveValue('North Diamond');

    const submit = screen.getByRole('button', { name: 'Save changes' });
    const firstKey = updateField.mock.calls[0]?.[4];
    expect(firstKey).toEqual(expect.any(String));
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(updateField).toHaveBeenCalledTimes(2));
    expect(updateField.mock.calls[1]?.[4]).toBe(firstKey);

    await user.type(name, ' Updated');
    await user.click(submit);
    await waitFor(() => expect(updateField).toHaveBeenCalledTimes(3));
    expect(updateField.mock.calls[2]?.[4]).not.toBe(firstKey);
  });

  it('adds a field in place and keeps the venue workbench context', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([venue]);
    const createdField: FieldAdmin = {
      ...field,
      fieldId: '71606e07-d007-49bb-8ba1-486451399c05',
      name: 'South Diamond',
      publicDirections: 'Continue past the main shelter.',
      fenceDistanceFeet: 275,
      version: 1,
    };
    const createField = vi.spyOn(browserApi, 'createField').mockResolvedValue(createdField);

    render(<VenueFieldManager organizationId={organizationId} />);
    const summary = (await screen.findByText('Demo Parks Complex')).closest('summary');
    await user.click(summary as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Add Field' }));
    await user.type(screen.getByLabelText('Field name (required)'), 'South Diamond');
    await user.type(
      screen.getByLabelText('Public directions (optional)'),
      'Continue past the main shelter.',
    );
    await user.type(screen.getByLabelText('Fence distance in feet (optional)'), '275');
    await user.click(screen.getByLabelText('Lights available'));
    await user.click(screen.getByRole('button', { name: 'Add field' }));

    await waitFor(() =>
      expect(createField).toHaveBeenCalledWith(
        organizationId,
        venueId,
        {
          name: 'South Diamond',
          publicDirections: 'Continue past the main shelter.',
          hasLights: true,
          fenceDistanceFeet: 275,
          active: true,
        },
        expect.any(String),
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('South Diamond was added.');
    expect(screen.getByText('South Diamond')).toBeInTheDocument();
    await waitFor(() => expect(summary).toHaveFocus());
  });

  it('distinguishes an edit-time duplicate name from a stale version', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([venue]);
    const updateVenue = vi.spyOn(browserApi, 'updateVenue').mockRejectedValue(
      new ApiError(409, {
        code: 'DUPLICATE_VENUE_NAME',
        message: 'Duplicate venue name.',
        requestId: 'synthetic-request',
      }),
    );

    render(<VenueFieldManager organizationId={organizationId} />);
    const summary = (await screen.findByText('Demo Parks Complex')).closest('summary');
    await user.click(summary as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Edit venue' }));
    const name = screen.getByLabelText('Venue name (required)');
    await user.clear(name);
    await user.type(name, 'Existing Park');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A record with this name already exists here. Choose a different name.',
    );
    expect(name).toHaveValue('Existing Park');
    expect(screen.queryByText(/Reload the page/)).not.toBeInTheDocument();
    expect(updateVenue).toHaveBeenCalledWith(
      organizationId,
      venueId,
      {
        expectedVersion: venue.version,
        name: 'Existing Park',
        active: true,
      },
      expect.any(String),
    );

    await user.clear(name);
    await user.type(name, 'Available Park');
    expect(screen.queryByText(/A record with this name already exists/)).not.toBeInTheDocument();
  });

  it('locks competing facility tasks while entries are unsaved and restores them on a blocked click', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([venue]);

    render(<VenueFieldManager organizationId={organizationId} />);
    const summary = (await screen.findByText('Demo Parks Complex')).closest('summary');
    await user.click(summary as HTMLElement);
    const editVenue = screen.getByRole('button', { name: 'Edit venue' });
    await user.click(editVenue);
    const panel = screen.getByRole('region', { name: 'Edit Demo Parks Complex' });
    const name = within(panel).getByLabelText('Venue name (required)');
    await user.clear(name);
    await user.type(name, 'Unsaved Riverside Complex');

    const addField = screen.getByRole('button', { name: 'Add Field' });
    expect(screen.getByRole('button', { name: 'Add Venue' })).toBeDisabled();
    expect(editVenue).toBeDisabled();
    expect(addField).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit Field One' })).toBeDisabled();
    await user.click(addField);

    expect(screen.getByRole('region', { name: 'Edit Demo Parks Complex' })).toBe(panel);
    expect(name).toHaveValue('Unsaved Riverside Complex');
    expect(screen.queryByRole('region', { name: 'Add field at Demo Parks Complex' })).toBeNull();

    await user.click(within(panel).getAllByRole('button', { name: 'Cancel' })[0] as HTMLElement);
    await waitFor(() => expect(editVenue).toHaveFocus());
    expect(addField).toBeEnabled();
  });

  it('keeps competing facility tasks disabled while a save is in flight', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([venue]);
    let resolveUpdate: (value: VenueAdmin) => void = () => undefined;
    vi.spyOn(browserApi, 'updateVenue').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<VenueFieldManager organizationId={organizationId} />);
    const summary = (await screen.findByText('Demo Parks Complex')).closest('summary');
    await user.click(summary as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Edit venue' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('button', { name: 'Add Venue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit venue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Field' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit Field One' })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Edit Demo Parks Complex' })).toBeInTheDocument();

    await act(async () => {
      resolveUpdate({ ...venue, version: venue.version + 1 });
      await Promise.resolve();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Demo Parks Complex was updated.');
  });

  it('marks an invalid directions textarea and associates its error message', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getVenues').mockResolvedValue([venue]);

    render(<VenueFieldManager organizationId={organizationId} />);
    const summary = (await screen.findByText('Demo Parks Complex')).closest('summary');
    await user.click(summary as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Add Field' }));
    await user.type(screen.getByLabelText('Field name (required)'), 'Long directions field');
    const directions = screen.getByLabelText('Public directions (optional)');
    await user.type(directions, 'x'.repeat(501));
    await user.click(screen.getByRole('button', { name: 'Add field' }));

    expect(directions).toHaveAttribute('aria-invalid', 'true');
    expect(directions).toHaveAttribute(
      'aria-describedby',
      'publicDirections-help publicDirections-error',
    );
    expect(
      screen.getByText('Use 500 characters or fewer.', { selector: '#publicDirections-error' }),
    ).toBeInTheDocument();
  });

  it('shows a permission-aware loading failure with a retry action', async () => {
    vi.spyOn(browserApi, 'getVenues').mockRejectedValue(
      new ApiError(403, {
        code: 'FORBIDDEN',
        message: 'Forbidden.',
        requestId: 'synthetic-request',
      }),
    );

    render(<VenueFieldManager organizationId={organizationId} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('do not have permission');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
