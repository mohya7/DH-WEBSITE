namespace DigitalHub.Api.Tests;

public enum UpdateOutcome
{
    Updated,
    Missing,
    Stale,
}

public sealed record NoteResponse(Guid Id, string Name, int Version, DateTime UpdatedAt);

public sealed class NoteStore
{
    private readonly object _gate = new();
    private readonly List<NoteResponse> _notes = [];

    public IReadOnlyList<NoteResponse> List()
    {
        lock (_gate)
        {
            return _notes.ToArray();
        }
    }

    public NoteResponse? Get(Guid id)
    {
        lock (_gate)
        {
            return _notes.FirstOrDefault(note => note.Id == id);
        }
    }

    public NoteResponse Add(string name)
    {
        var note = new NoteResponse(Guid.NewGuid(), name.Trim(), 1, DateTime.UtcNow);
        lock (_gate)
        {
            _notes.Add(note);
        }

        return note;
    }

    public UpdateOutcome Update(Guid id, string name, int version)
    {
        lock (_gate)
        {
            var index = _notes.FindIndex(note => note.Id == id);
            if (index < 0)
            {
                return UpdateOutcome.Missing;
            }

            var current = _notes[index];
            if (current.Version != version)
            {
                return UpdateOutcome.Stale;
            }

            _notes[index] = current with
            {
                Name = name.Trim(),
                Version = current.Version + 1,
                UpdatedAt = DateTime.UtcNow,
            };
            return UpdateOutcome.Updated;
        }
    }
}
