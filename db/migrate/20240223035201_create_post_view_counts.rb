class CreatePostViewCounts < ActiveRecord::Migration[7.1]
  def change
    create_table :post_view_counts do |t|
      t.references :post, null: false
      t.integer :count, default: 0, null: false
      t.timestamps
    end
  end
end
