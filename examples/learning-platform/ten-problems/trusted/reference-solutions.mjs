export const tenProblemsReferenceSolutions = Object.freeze([
  Object.freeze({
    groupId: "sequences",
    questionId: "first-echo",
    source: `def first_echo(values):
    seen = set()
    for value in values:
        if value in seen:
            return value
        seen.add(value)
    return None
`,
  }),
  Object.freeze({
    groupId: "sequences",
    questionId: "tunnel-gates",
    source: `def gates_close_cleanly(events):
    stack = []
    for event in events:
        if event.isupper():
            stack.append(event)
        elif not stack or stack.pop() != event.upper():
            return False
    return not stack
`,
  }),
  Object.freeze({
    groupId: "sequences",
    questionId: "quietest-window",
    source: `def quietest_window(readings, width):
    window_total = sum(readings[:width])
    best_total = window_total
    best_index = 0
    for right in range(width, len(readings)):
        window_total += readings[right] - readings[right - width]
        if window_total < best_total:
            best_total = window_total
            best_index = right - width + 1
    return best_index
`,
  }),
  Object.freeze({
    groupId: "sequences",
    questionId: "longest-unique-span",
    source: `def longest_unique_span(text):
    latest = {}
    left = 0
    best = 0
    for right, character in enumerate(text):
        left = max(left, latest.get(character, -1) + 1)
        latest[character] = right
        best = max(best, right - left + 1)
    return best
`,
  }),
  Object.freeze({
    groupId: "structures",
    questionId: "reverse-chain",
    source: `def reverse_chain(head):
    output = None
    node = head
    while node is not None:
        output = {"value": node["value"], "next": output}
        node = node["next"]
    return output
`,
  }),
  Object.freeze({
    groupId: "structures",
    questionId: "condense-calendar",
    source: `def condense_windows(windows):
    ordered = sorted([list(window) for window in windows])
    output = []
    for window in ordered:
        if not output or window[0] > output[-1][1]:
            output.append(window)
        else:
            output[-1][1] = max(output[-1][1], window[1])
    return output
`,
  }),
  Object.freeze({
    groupId: "frontiers",
    questionId: "disease-spread-clock",
    source: `from collections import deque

def minutes_to_reach_all(grid):
    queue = deque()
    seen = set()
    healthy = 0
    for row in range(len(grid)):
        for column in range(len(grid[row])):
            if grid[row][column] == "S":
                queue.append((row, column, 0))
                seen.add((row, column))
            elif grid[row][column] == "H":
                healthy += 1
    reached = 0
    minutes = 0
    while queue:
        row, column, minute = queue.popleft()
        for row_delta, column_delta in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            next_row = row + row_delta
            next_column = column + column_delta
            if not (0 <= next_row < len(grid)):
                continue
            if not (0 <= next_column < len(grid[next_row])):
                continue
            if grid[next_row][next_column] != "H":
                continue
            if (next_row, next_column) in seen:
                continue
            seen.add((next_row, next_column))
            reached += 1
            minutes = minute + 1
            queue.append((next_row, next_column, minute + 1))
    return minutes if reached == healthy else -1
`,
  }),
  Object.freeze({
    groupId: "frontiers",
    questionId: "fewest-relay-hops",
    source: `from collections import deque

def fewest_relay_hops(node_count, links, start, goal):
    if start == goal:
        return 0
    neighbors = [[] for _ in range(node_count)]
    for left, right in links:
        neighbors[left].append(right)
        neighbors[right].append(left)
    queue = deque([(start, 0)])
    seen = {start}
    while queue:
        node, distance = queue.popleft()
        for neighbor in neighbors[node]:
            if neighbor == goal:
                return distance + 1
            if neighbor not in seen:
                seen.add(neighbor)
                queue.append((neighbor, distance + 1))
    return -1
`,
  }),
  Object.freeze({
    groupId: "optimization",
    questionId: "minimum-climb-energy",
    source: `def minimum_climb_energy(heights):
    if len(heights) == 1:
        return 0
    two_back = 0
    one_back = abs(heights[1] - heights[0])
    for index in range(2, len(heights)):
        current = min(
            one_back + abs(heights[index] - heights[index - 1]),
            two_back + abs(heights[index] - heights[index - 2]),
        )
        two_back, one_back = one_back, current
    return one_back
`,
  }),
  Object.freeze({
    groupId: "optimization",
    questionId: "workday-capacity",
    source: `def minimum_daily_capacity(loads, days):
    low = max(loads)
    high = sum(loads)
    while low < high:
        capacity = (low + high) // 2
        used_days = 1
        current = 0
        for load in loads:
            if current + load > capacity:
                used_days += 1
                current = 0
            current += load
        if used_days <= days:
            high = capacity
        else:
            low = capacity + 1
    return low
`,
  }),
]);
