class ApplicationController < ActionController::API
  rescue_from ActionController::ParameterMissing, with: ->(e) { render_error(422, e) }
  rescue_from Date::Error, with: -> { render_error(422, "Invalid date provided") }
  rescue_from RedisCounter::VerificationError, ActiveSupport::MessageVerifier::InvalidSignature, with: :render_verification_error

  protected

  def render_error(status, message)
    render json: {
      success: false,
      message: message,
      code: nil,
    }, status: status
  end

  def render_verification_error
    render_error(403, "Invalid signature")
  end

  def verify_signature(data, cast: :itself)
    verifier = ActiveSupport::MessageVerifier.new(Reports.config.report_key, serializer: JSON, digest: "SHA256")
    res = verifier.verify(data)
    value, session_id = res.split(",")
    [value.send(cast), session_id]
  end
end
