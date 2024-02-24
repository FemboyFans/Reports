class PostSearchesController < ApplicationController

  def show
    if params[:id] == "rank"
      @date = Date.parse(params.require(:date).to_s).to_s
      render json: (SearchCounter.new.get_rank(@date, SearchCounter::LIMIT) || []).to_json
    end
  end

  def create
    if params[:sig]
      tags, session_id = verify_signature(params[:sig])
      SearchCounter.new.count!(tags, session_id)
      head 204
    else
      render_verification_error
    end
  end
end
