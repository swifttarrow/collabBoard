-- Frames specification: hierarchical scene graph with parent-child relationships.
-- parent_id: null = board root, otherwise references parent frame/node.
-- clip_content: when true, frame clips child rendering to bounds (frame type only).

alter table board_objects
  add column parent_id uuid references board_objects(id) on delete set null,
  add column clip_content boolean not null default false;

create index if not exists idx_board_objects_parent_id on board_objects(parent_id);
create index if not exists idx_board_objects_board_parent on board_objects(board_id, parent_id);
