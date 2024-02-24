class CreatePostViewSummaries < ActiveRecord::Migration[7.1]
  def change
    create_table :post_view_summaries do |t|
      t.string :date, null: false
      t.jsonb :data, default: "{}", null: false
      t.timestamps
    end
  end
end
