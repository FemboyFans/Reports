class MissedSearchCounter
  include RedisCounter
  class UnknownKeyError < StandardError; end

  LIMIT = 100

  def rank(limit)
    date = Time.zone.today
    keys = 7.times.map { |x| "msc-#{date.prev_day(x).strftime('%Y%m%d')}" }
    Cache.redis.zunionstore("msc-all", keys)
    Cache.redis.zrevrange("msc-all", 0, limit, with_scores: true)&.map do |rank|
      { tag: rank[0], count: rank[1].to_i }
    end || []
  end

  def count!(tags, session_id)
    tags = normalize_tags(tags)
    code = hash(tags)
    today = Time.now.strftime("%Y%m%d")

    if Cache.redis.pfadd("msc-#{code}-#{today}", session_id)
      Cache.redis.pipelined do
        Cache.redis.expire("msc-#{code}-#{today}", 1.day.to_i)
        Cache.redis.zincrby("msc-#{today}", 1.0, tags)
        Cache.redis.expire("msc-#{today}", 7.days.to_i)
      end
    end
  end
end
