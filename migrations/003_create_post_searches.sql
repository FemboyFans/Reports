CREATE TABLE IF NOT EXISTS post_searches (
    id UUID DEFAULT generateUUIDv4() PRIMARY KEY,
    tags Array(String),
    page UInt64,
    date Date DEFAULT today(),
    INDEX idx_query (tags) TYPE set(0) GRANULARITY 1,
    INDEX idx_page (page) TYPE set(0) GRANULARITY 1,
    INDEX idx_date (date) TYPE minmax GRANULARITY 1
)
ENGINE = MergeTree()
ORDER BY id;
