CREATE TABLE IF NOT EXISTS post_views (
    id UUID DEFAULT generateUUIDv4() PRIMARY KEY,
    post_id UInt64,
    ip_address IPv6,
    date Date DEFAULT today(),
    INDEX idx_post_id (post_id) TYPE minmax GRANULARITY 1,
    INDEX idx_address (ip_address) TYPE set(0) GRANULARITY 1,
    INDEX idx_date (date) TYPE minmax GRANULARITY 1
)
ENGINE = MergeTree()
ORDER BY id;
