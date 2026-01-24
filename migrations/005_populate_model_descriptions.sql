-- Populate model descriptions for all active models
UPDATE models SET model_description = 'A mixture-of-experts model with 109B parameters offering balanced performance across diverse prediction tasks. Excels at pattern recognition in sports data with strong generalization.' WHERE id = 'cogito-109b-moe';

UPDATE models SET model_description = 'Meta''s latest 70B parameter model providing advanced reasoning and contextual understanding. Optimized for complex multi-factor analysis in prediction scenarios.' WHERE id = 'together-meta-llama-3.3-70b';

UPDATE models SET model_description = 'A 70B parameter model from Meta with strong instruction-following capabilities. Reliable performer for structured prediction tasks with consistent accuracy.' WHERE id = 'together-meta-llama-3-70b';

UPDATE models SET model_description = 'Lightweight 8B model balancing speed and accuracy. Ideal for real-time predictions requiring low latency without sacrificing prediction quality.' WHERE id = 'together-meta-llama-3-8b';

UPDATE models SET model_description = 'Efficient 7B model from Mistral with strong performance on analytical tasks. Fast processing makes it suitable for high-frequency prediction updates.' WHERE id = 'together-mistral-7b';

UPDATE models SET model_description = 'Advanced 72B model with enhanced reasoning capabilities. Particularly effective at multi-step analysis required for comprehensive sports predictions.' WHERE id = 'together-qwen-2-72b';

UPDATE models SET model_description = 'Compact 7B model with strong performance on specialized tasks. Quick and efficient while maintaining good prediction accuracy.' WHERE id = 'together-qwen-2-7b';

UPDATE models SET model_description = 'Specialized model for conversational analysis with 7B parameters. Good at extracting insights from textual data sources.' WHERE id = 'together-neural-chat-7b';

UPDATE models SET model_description = 'High-performance 70B model optimized for fast inference. Delivers consistent predictions with minimal latency.' WHERE id = 'groq-llama-70b';

UPDATE models SET model_description = 'Fast 8B model running on Groq infrastructure. Excellent for real-time prediction requirements.' WHERE id = 'groq-llama-8b';

UPDATE models SET model_description = 'Mixture-of-experts architecture with 8x7B experts. Provides sophisticated multi-path reasoning for complex predictions.' WHERE id = 'groq-mixtral-8x7b';

-- Fallback for any remaining models without descriptions
UPDATE models SET model_description = 'A high-performance AI model optimized for football prediction analysis. Provides accurate match outcome and score predictions based on team statistics and recent form.' WHERE model_description IS NULL AND active = true;
