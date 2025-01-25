CREATE TABLE api_key_usages (
    date Date DEFAULT today(),
    key_id UInt32,
    controller String,
    action String,
    method String,
    request_uri String,
    ip_address IPv6
)
    ENGINE = MergeTree()
    PARTITION BY toYYYYMM(date)
    ORDER BY (date, key_id)
    TTL date + INTERVAL 3 MONTH;
