using System.Collections.Concurrent;

namespace DigitalHub.Api.Content;

/// <summary>
/// Remembers a hash of an application for two minutes so a double submit does not
/// send twice. Entries older than the window are dropped on the next use, and the
/// map never grows past <see cref="MaxEntries"/>. Only hashes are kept.
/// </summary>
public sealed class ApplyDedupe(TimeProvider clock)
{
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(2);
    public const int MaxEntries = 10_000;

    private readonly ConcurrentDictionary<string, DateTimeOffset> _seen = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _gates = new();

    public int Count => _seen.Count;

    public SemaphoreSlim Gate(string key) => _gates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));

    public bool RecentlySeen(string key)
    {
        Sweep();
        if (!_seen.TryGetValue(key, out var at))
            return false;
        if (clock.GetUtcNow() - at < Window)
            return true;
        _seen.TryRemove(key, out _);
        return false;
    }

    public void Remember(string key)
    {
        _seen[key] = clock.GetUtcNow();
        Sweep();
    }

    private void Sweep()
    {
        var now = clock.GetUtcNow();
        foreach (var entry in _seen)
        {
            if (now - entry.Value >= Window)
                _seen.TryRemove(entry.Key, out _);
        }

        while (_seen.Count > MaxEntries)
        {
            string? oldest = null;
            var oldestAt = DateTimeOffset.MaxValue;
            foreach (var entry in _seen)
            {
                if (entry.Value < oldestAt)
                {
                    oldest = entry.Key;
                    oldestAt = entry.Value;
                }
            }

            if (oldest is null || !_seen.TryRemove(oldest, out _))
                break;
        }

        foreach (var key in _gates.Keys)
        {
            if (_seen.ContainsKey(key))
                continue;
            if (_gates.TryGetValue(key, out var gate) && gate.CurrentCount == 1 && _gates.TryRemove(key, out var removed))
                removed.Dispose();
        }
    }
}
