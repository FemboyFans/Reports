class PostViewsController < ApplicationController

  def show
    case params[:id]
    when "rank"
      @date = Date.parse(params.require(:date).to_s).strftime("%Y%m%d")
      render json: (ViewCounter.new.get_rank(@date, limit(default: ViewCounter::LIMIT)) || {}).to_json

    when /\A\d+\Z/
      render json: { count: ViewCounter.new.get_count(params[:id]).to_s }

    else
      raise ActiveRecord::RecordNotFound
    end
  end

  def create
    if params[:sig]
      post_id, session_id = verify_signature(params[:sig], cast: :to_i)
      ViewCounter.new.count!(post_id, session_id)
      head 204
    else
      render_verification_error
    end
  end
end
