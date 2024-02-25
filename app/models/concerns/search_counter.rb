class SearchCounter
  include RedisCounter
  class UnknownKeyError < StandardError; end

  LIMIT = 100

  def self.expunge!
    Cache.redis.scan_each(match: "ps-week-*") do |key|
      Cache.redis.del(key)
    end
    Cache.redis.scan_each(match: "ps-month-*") do |key|
      Cache.redis.del(key)
    end
    Cache.redis.scan_each(match: "psu-*") do |key|
      Cache.redis.del(key)
    end
  end

  def get_rank(date, limit)
    key = "ps-day-#{date}"
    Cache.redis.zrevrange(key, 0, limit, with_scores: true)&.map do |rank|
      { tag: rank[0], count: rank[1].to_i }
    end || []
  end

  def prune!
    yesterday = 1.day.ago.strftime("%Y%m%d")

    Cache.redis.zremrangebyrank("ps-day-#{yesterday}", 0, -LIMIT)
  end

  def count!(key, value)
    case key
    when /^ps-(.+)/
      increment_post_search_count($1, value)

    else
      raise UnknownKeyError
    end
  end

  def increment_post_search_count(tags, session_id)
    tags = normalize_tags(tags)
    code = hash(tags)
    today = Time.now.strftime("%Y%m%d")
    week = Time.now.to_i / (60 * 60 * 24 * 7)

    if Cache.redis.pfadd("ps-#{code}-#{today}", session_id)
      month = Time.now.strftime("%Y%m")

      Cache.redis.pipelined do
        Cache.redis.expire("ps-#{code}-#{today}", 2.days)
        Cache.redis.zincrby("ps-day-#{today}", 1, tags)
      end
    end
  end
end
