class MissedSearchesController < ApplicationController

  def show
    if params[:id] == "rank"
      render json: (MissedSearchCounter.new.rank(limit(default: MissedSearchCounter::LIMIT)) || {}).to_json
    end
  end

  def create
    if params[:sig]
      tags, session_id = verify_signature(params[:sig])
      MissedSearchCounter.new.count!(tags, session_id)
      head 204
    else
      render_verification_error
    end
  end
end
