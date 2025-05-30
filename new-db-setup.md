## Dropping & Rebuilding the Database
If necessary, start by dropping and recreating the database:

```sh
rails db:drop
rails db:create
rails db:migrate
```

If using PostgreSQL directly:

```sh
psql -U your_user -d your_database -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

Then run migrations to set up the schema:

```sh
rails db:migrate
```

---

## 2️⃣ Required Tables: targets, target_kinds, and note_kinds
Ensure that the following tables exist in your database:

### 🗄 Table: target_kinds
This table defines the types of targets (e.g., booking count, achievements, etc.).

| Column         | Type       | Description                                      |
|---------------|-----------|--------------------------------------------------|
| id           | SERIAL    | Primary key                                     |
| name         | STRING    | Name of the target kind                         |
| rules        | JSONB     | Defines the logic (e.g., filtering by booking count) |
| is_achievement | BOOLEAN  | true if this is an achievement, otherwise false |
| created_at   | TIMESTAMP | Timestamp for record creation                    |
| updated_at   | TIMESTAMP | Timestamp for last update                        |

✅ Example Row:

```json
{
	"id": 3,
	"name": "Booking Count",
	"rules": "{\"filter_by\":\"booking_count\"}",
	"is_achievement": false,
	"created_at": "2025-03-12 16:19:57.541242",
	"updated_at": "2025-03-12 16:19:57.541242"
}
```

### 🗄 Table: targets
This table tracks specific user targets or achievements related to the target kinds.

| Column         | Type       | Description                                      |
|---------------|-----------|--------------------------------------------------|
| id           | SERIAL    | Primary key                                     |
| title        | STRING    | Display name for the target                    |
| description  | TEXT      | (Optional) Description of the target            |
| target       | INTEGER   | Goal value (e.g., 50 bookings)                   |
| achieved     | INTEGER   | Current progress                                |
| start_date   | DATE      | Start of the tracking period                    |
| end_date     | DATE      | End of the tracking period                      |
| target_kind_id | INTEGER | Foreign key to target_kinds.id                   |
| user_ids     | ARRAY     | Users associated with the target                 |
| location_ids | ARRAY     | (Optional) Locations tied to the target         |
| created_at   | TIMESTAMP | Timestamp for record creation                    |
| updated_at   | TIMESTAMP | Timestamp for last update                        |

✅ Example Row:

```json
{
	"id": 1,
	"title": "Bokningar denna månad",
	"description": null,
	"target": 50,
	"achieved": 0,
	"start_date": "2025-03-01",
	"end_date": "2025-04-01",
	"target_kind_id": 3,
	"user_ids": "{19}",
	"location_ids": null,
	"created_at": "2025-03-12 16:20:51.851535",
	"updated_at": "2025-03-12 16:20:51.851535"
}
```

### 🗄 Table: note_kinds
This table categorizes different types of notes.

| Column      | Type       | Description                    |
|------------|-----------|--------------------------------|
| id         | SERIAL    | Primary key                   |
| title      | STRING    | Name of the note kind         |
| created_at | TIMESTAMP | Timestamp for record creation |
| updated_at | TIMESTAMP | Timestamp for last update     |

---

## 3️⃣ Seeding Data (`db/seeds.rb`)
To populate the database with essential targets, target kinds, and note kinds, add this seeding script to `db/seeds.rb`:

```ruby
require 'json'

puts "🔄 Seeding target kinds..."

target_kinds = [
  { name: "Booking Count", rules: { filter_by: "booking_count" }.to_json, is_achievement: false },
  { name: "Bookings a Day", rules: { filter_by: "daily_booking_count", min_bookings: 5 }.to_json, is_achievement: true }
]

target_kinds.each do |kind|
  TargetKind.find_or_create_by!(name: kind[:name]) do |tk|
    tk.rules = kind[:rules]
    tk.is_achievement = kind[:is_achievement]
  end
end

puts "✅ Target kinds seeded!"

puts "🔄 Seeding targets..."

targets = [
  { title: "Bokningar denna månad", target: 50, achieved: 0, start_date: Date.today.beginning_of_month, end_date: Date.today.end_of_month, target_kind: TargetKind.find_by(name: "Booking Count"), user_ids: [19] },
  { title: "Dagar med 5+ bokningar", target: 0, achieved: 0, start_date: Date.today.beginning_of_year, end_date: Date.today.end_of_year, target_kind: TargetKind.find_by(name: "Bookings a Day"), user_ids: nil }
]

targets.each do |target|
  Target.create!(target)
end

puts "✅ Targets seeded!"

puts "🔄 Seeding note kinds..."

note_kinds = [
  { title: "General" },
  { title: "Feedback" },
  { title: "Meeting Notes" }
]

note_kinds.each do |note_kind|
  NoteKind.find_or_create_by!(title: note_kind[:title])
end

puts "✅ Note kinds seeded!"
```

Then, run:

```sh
rails db:seed
```

---

## 4️⃣ Querying Achievements in the Svelte Project
You can fetch achievements in SvelteKit using:

```ts
export async function getAchievements(userId: number) {
    const response = await fetch(`/api/achievements?userId=${userId}`);
    return response.json();
}
```

---

## 5️⃣ Notes & Next Steps
- Ensure `targets`, `target_kinds`, and `note_kinds` exist before adding records.
- Use JSONB fields in `rules` for flexible filtering.
- Update the SvelteKit frontend to display achievements dynamically.





##6 Add color to locations table

ALTER TABLE locations
ADD COLUMN color TEXT DEFAULT '#6b7280';




-- 1. Create the event_types table
CREATE TABLE event_types (
    id SERIAL PRIMARY KEY,
    type VARCHAR(255)
);

-- 2. Add event_type_id to the events table
ALTER TABLE events
ADD COLUMN event_type_id INTEGER;

-- 3. (Optional) Add foreign key constraint if you want referential integrity
-- ALTER TABLE events
-- ADD CONSTRAINT fk_event_type
-- FOREIGN KEY (event_type_id)
-- REFERENCES event_types(id);

-- 4. Insert default event types
INSERT INTO event_types (type) VALUES ('client');
INSERT INTO event_types (type) VALUES ('alert');


---5. update done handling

CREATE TABLE events_done (
	id SERIAL PRIMARY KEY,
	event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	done_at TIMESTAMP NOT NULL DEFAULT now(),
	UNIQUE (event_id, user_id)
);


CREATE INDEX idx_events_done_user_event ON events_done (user_id, event_id);

---6. created_by added

ALTER TABLE events
ADD COLUMN created_by INTEGER REFERENCES users(id);


--------

Alter table with sequence id

-- If not already serial:
CREATE SEQUENCE IF NOT EXISTS targets_id_seq OWNED BY targets.id;

-- Attach the sequence to the `id` column
ALTER TABLE targets ALTER COLUMN id SET DEFAULT nextval('targets_id_seq');

-- Set the sequence to continue from the highest used id
SELECT setval('targets_id_seq', (SELECT MAX(id) FROM targets));