# Similar to hit counter, but only uses Redis as a cache and persists
# the counts to the DB.

# requirements:
# - all counts are for a unique session
# - every time a user visits a post in a day, count that as one view
# - get a count of unique visitors for a post for a day
#   - key: hll-$POSTID-$DATE (expires in 1 day)
# - get a count of unique visitors for a post for all time
#   - key: vc-$POSTID (expires in 1 day, backed by db)
# - get the most viewed posts on a given day
#   - key: vc-rank-$DATE (expires in 1 day, backed by db)
#
class ViewCounter
  LIMIT = 100

  def get_count(post_id)
    key = "vc-#{post_id}"
    (Cache.redis.get(key) || fetch_post_view_count(post_id)).to_i
  end

  def count!(post_id, session_id)
    full_key = "vc-#{post_id}"
    if unique?(post_id, session_id)
      val = increment_redis_count(post_id)
      add_rank(post_id)
      Cache.redis.setex("udb-#{post_id}", 10, "1")
      val
    else
      Cache.redis.get(full_key).to_i
    end
  end

  def increment_redis_count(post_id)
    key = "vc-#{post_id}"
    if Cache.redis.exists(key)
      val = Cache.redis.incr(key)
      Cache.redis.expire(key, redis_expiry)
      update_db_count(post_id, val) if update_db?(post_id)
    else
      val = fetch_post_view_count(post_id)
    end
    val
  end

  def assign_redis_count(post_id, count)
    key = "vc-#{post_id}"
    Cache.redis.setex(key, redis_expiry, count)
  end

  def fetch_post_view_count(post_id)
    item = PostViewCount.find_or_create_by(post_id: post_id).increment!(:count, touch: true)
    assign_redis_count(post_id, item.count)
    item.count
  end

  def update_db_count(post_id, count)
    PostViewCount.find_or_create_by(post_id: post_id).update(count: count)
  end

  def date_key
    @date_key ||= format_date(Time.now)
  end

  def unique?(post_id, session_id)
    key = "hll-#{date_key}-#{post_id}"
    if Cache.redis.pfadd(key, session_id)
      Cache.redis.expire(key, redis_expiry)
      true
    else
      false
    end
  end

  def add_rank(post_id)
    key = "vc-rank-#{date_key}"
    Cache.redis.zincrby(key, 1.0, post_id)
    Cache.redis.expire(key, redis_expiry)
    update_db_rank(date_key, get_rank(date_key, 100)) if Cache.redis.get("udb-rank").nil?
  end

  def get_rank(date, limit)
    if Cache.redis.exists("vc-rank-json-#{date}") == 1
      JSON.parse(Cache.redis.get("vc-rank-json-#{date}"))
    elsif Cache.redis.exists("vc-rank-#{date}") == 1
      Cache.redis.zrevrange("vc-rank-#{date}", 0, limit, with_scores: true).to_h
    else
      fetch_rank(date)
    end
  end

  def assign_redis_rank(date, jsons)
    Cache.redis.setex("vc-rank-json-#{date}", redis_expiry, jsons)
  end

  def update_db_rank(date, jsons)
    # for some reason, providing date as a hash here results in the value being converted into a date,
    # making it different every time this function is ran, thus we need to specify it explicitly,
    # and can't use find_or_create_by
    item = PostViewSummary.find_by("date = '#{date}'")
    if item
      item.update(data: jsons)
    else
      PostViewSummary.create!(date: date, data: jsons)
    end
    Cache.redis.setex("udb-rank", 60, "1")
  end

  def format_date(date)
    return date unless date.is_a?(Time)
    date.strftime("%Y-%m-%d")
  end

  def fetch_rank(date)
    item = PostViewSummary.find_by("date = '#{format_date(date)}'")
    if item
      assign_redis_rank(date, item.data.to_json)
      item.data
    end
  end

  def redis_expiry
    1.day.to_i
  end

  def update_db?(post_id)
    Cache.redis.get("udb-#{post_id}").nil?
  end
end
