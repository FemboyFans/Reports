module RedisCounter
  class VerificationError < SecurityError; end

  def hash(string)
    Digest::MD5.hexdigest(string)
  end

  def normalize_tags(tags)
    tags.to_s.gsub("\u3000", " ").downcase.strip.scan(/\S+/).uniq.sort.join(" ")
  end

  def validate!(key, value, sig)
    if sig =~ /--/
      verifier = ActiveSupport::MessageVerifier.new(Reports.config.report_key, serializer: JSON, digest: "SHA256")
      calc_sig = verifier.generate("#{key},#{value}")
    else
      digest = OpenSSL::Digest.new("sha256")
      calc_sig = OpenSSL::HMAC.hexdigest(digest, Reports.config.report_key, "#{key},#{value}")
    end

    if calc_sig != sig
      raise VerificationError, "Failed to verify signature"
    end
  end
end
